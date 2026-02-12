import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { GoogleGenAI } from "@google/genai";
import * as XLSX from "xlsx";
import {
  insertUserSchema,
  insertCourseSchema,
  insertLectureSchema,
  insertQuizSchema,
  insertAssignmentSchema,
  insertEnrollmentSchema,
  insertQuizSubmissionSchema,
  insertProctoringViolationSchema,
} from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendPasswordResetEmail, sendUsernameReminderEmail } from "./email";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const platformAi = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

async function getAiClient(userId?: string): Promise<GoogleGenAI> {
  if (userId) {
    const user = await storage.getUser(userId);
    if (user?.geminiApiKey) {
      return new GoogleGenAI({ apiKey: user.geminiApiKey });
    }
  }
  return platformAi;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

async function requireInstructor(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || (user.role !== "instructor" && user.role !== "admin")) {
    return res.status(403).json({ error: "Instructor access required" });
  }
  next();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "eduassess-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  registerObjectStorageRoutes(app);

  // Seed default admin account if none exists
  const existingAdmin = await storage.getUserByUsername("admin");
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await storage.createUser({
      username: "admin",
      password: hashedPassword,
      email: "admin@eduassess.ai",
      name: "Administrator",
      role: "admin",
    });
    console.log("Default admin account created (username: admin, password: admin123)");
  }

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      
      const existingUsername = await storage.getUserByUsername(data.username);
      if (existingUsername) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }
      
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({ ...data, password: hashedPassword });
      
      req.session.userId = user.id;
      const { password: _, patternHash: _ph, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ error: "Invalid registration data" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      req.session.userId = user.id;
      const { password: _, patternHash: _ph, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await storage.getUserByEmail(email.trim().toLowerCase());
      if (user) {
        try {
          const token = crypto.randomBytes(32).toString("hex");
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
          await storage.createPasswordResetToken(user.id, token, expiresAt);

          const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
          const resetUrl = `${baseUrl}/reset-password/${token}`;
          await sendPasswordResetEmail(user.email, resetUrl, user.name);
        } catch (emailErr) {
          console.error("Failed to send password reset email:", emailErr);
        }
      }

      res.json({ message: "If an account with that email exists, a password reset link has been sent." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword || typeof newPassword !== "string") {
        return res.status(400).json({ error: "Token and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ error: "Invalid or expired reset link" });
      }

      if (resetToken.used) {
        return res.status(400).json({ error: "This reset link has already been used" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ error: "This reset link has expired" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(resetToken.userId, { password: hashedPassword });
      await storage.markPasswordResetTokenUsed(token);

      res.json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.post("/api/auth/forgot-username", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await storage.getUserByEmail(email.trim().toLowerCase());
      if (user) {
        try {
          await sendUsernameReminderEmail(user.email, user.username, user.name);
        } catch (emailErr) {
          console.error("Failed to send username reminder email:", emailErr);
        }
      }

      res.json({ message: "If an account with that email exists, your username has been sent." });
    } catch (error) {
      console.error("Forgot username error:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    const { password: _, geminiApiKey: _k, patternHash: _ph, ...userWithoutSensitive } = user;
    res.json({ ...userWithoutSensitive, hasGeminiKey: !!user.geminiApiKey, hasPattern: !!user.patternHash });
  });

  // Admin - User Management
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const role = req.query.role as string | undefined;
      const users = await storage.getUsers(role);
      const sanitized = users.map(u => {
        const { password, patternHash, geminiApiKey, ...safe } = u;
        return safe;
      });
      res.json(sanitized);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);

      const existingUsername = await storage.getUserByUsername(data.username);
      if (existingUsername) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({ ...data, password: hashedPassword });
      const { password: _, patternHash: _ph, geminiApiKey: _gk, ...userSafe } = user;
      res.status(201).json(userSafe);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(400).json({ error: "Invalid user data" });
    }
  });

  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getUser(id);
      if (!existing) {
        return res.status(404).json({ error: "User not found" });
      }

      const updates: Partial<User> = {};
      if (req.body.name) updates.name = req.body.name;
      if (req.body.email) updates.email = req.body.email;
      if (req.body.role) updates.role = req.body.role;
      if (req.body.password) {
        updates.password = await bcrypt.hash(req.body.password, 10);
      }

      const updated = await storage.updateUser(id, updates);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password: _, patternHash: _ph, geminiApiKey: _gk, ...userSafe } = updated;
      res.json(userSafe);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      if (id === req.session.userId) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      const existing = await storage.getUser(id);
      if (!existing) {
        return res.status(404).json({ error: "User not found" });
      }
      await storage.deleteUser(id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Settings - Gemini API Key
  app.get("/api/settings/gemini-key", requireInstructor, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });
      const maskedKey = user.geminiApiKey
        ? user.geminiApiKey.slice(0, 6) + "..." + user.geminiApiKey.slice(-4)
        : null;
      res.json({ hasKey: !!user.geminiApiKey, maskedKey });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings/gemini-key", requireInstructor, async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (apiKey !== undefined && apiKey !== null && typeof apiKey !== "string") {
        return res.status(400).json({ error: "Invalid API key format" });
      }
      const updated = await storage.updateUser(req.session.userId!, {
        geminiApiKey: apiKey || null,
      });
      if (!updated) return res.status(404).json({ error: "User not found" });
      res.json({ success: true, hasKey: !!apiKey });
    } catch (error) {
      res.status(500).json({ error: "Failed to update API key" });
    }
  });

  app.post("/api/settings/test-gemini-key", requireInstructor, async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey) return res.status(400).json({ error: "API key required" });
      const testAi = new GoogleGenAI({ apiKey });
      const response = await testAi.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Say hello in one word.",
      });
      if (response.text) {
        res.json({ valid: true, message: "API key is working" });
      } else {
        res.json({ valid: false, message: "No response from Gemini" });
      }
    } catch (error: any) {
      res.json({ valid: false, message: error.message || "Invalid API key" });
    }
  });

  // Pattern Lock Settings
  app.get("/api/settings/pattern", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({ enabled: !!user.patternHash });
    } catch (error) {
      console.error("Get pattern status error:", error);
      res.status(500).json({ error: "Failed to get pattern status" });
    }
  });

  app.put("/api/settings/pattern", requireAuth, async (req, res) => {
    try {
      const { pattern } = req.body;
      if (!pattern || !Array.isArray(pattern) || pattern.length < 4) {
        return res.status(400).json({ error: "Pattern must connect at least 4 dots" });
      }
      const valid = pattern.every((n: any) => typeof n === "number" && n >= 0 && n <= 8);
      const unique = new Set(pattern).size === pattern.length;
      if (!valid || !unique) {
        return res.status(400).json({ error: "Invalid pattern: must be unique dots numbered 0-8" });
      }
      const patternString = pattern.join("-");
      const patternHash = await bcrypt.hash(patternString, 10);
      await storage.updateUser(req.session.userId!, { patternHash });
      res.json({ message: "Pattern lock set successfully", enabled: true });
    } catch (error) {
      console.error("Set pattern error:", error);
      res.status(500).json({ error: "Failed to set pattern" });
    }
  });

  app.delete("/api/settings/pattern", requireAuth, async (req, res) => {
    try {
      await storage.updateUser(req.session.userId!, { patternHash: null });
      res.json({ message: "Pattern lock removed", enabled: false });
    } catch (error) {
      console.error("Clear pattern error:", error);
      res.status(500).json({ error: "Failed to clear pattern" });
    }
  });

  // Pattern Login (public)
  app.post("/api/auth/pattern-login", async (req, res) => {
    try {
      const { username, pattern } = req.body;
      if (!username || !pattern || !Array.isArray(pattern)) {
        return res.status(400).json({ error: "Username and pattern are required" });
      }
      const user = await storage.getUserByUsername(username.trim());
      if (!user || !user.patternHash) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const patternString = pattern.join("-");
      const isMatch = await bcrypt.compare(patternString, user.patternHash);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      req.session.userId = user.id;
      const { password: _, patternHash: __, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Pattern login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Dashboard
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats(req.session.userId!);
      res.json(stats);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Courses
  app.get("/api/courses", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ error: "User not found" });
      
      if (user.role === "student") {
        const enrollments = await storage.getEnrollments(undefined, user.id);
        const courses = [];
        for (const e of enrollments) {
          const course = await storage.getCourse(e.courseId);
          if (course) courses.push(course);
        }
        return res.json(courses);
      }
      
      const courses = await storage.getCourses(user.role === "admin" ? undefined : user.id);
      res.json(courses);
    } catch (error) {
      console.error("Get courses error:", error);
      res.status(500).json({ error: "Failed to fetch courses" });
    }
  });

  app.post("/api/courses", requireInstructor, async (req, res) => {
    try {
      const data = insertCourseSchema.omit({ instructorId: true }).parse(req.body);
      const course = await storage.createCourse({
        ...data,
        instructorId: req.session.userId!,
      });
      res.status(201).json(course);
    } catch (error) {
      console.error("Create course error:", error);
      res.status(400).json({ error: "Failed to create course" });
    }
  });

  app.post("/api/courses/import", requireInstructor, async (req, res) => {
    try {
      const { fileData, fileType } = req.body as { fileData: string; fileType: string };
      if (!fileData) {
        return res.status(400).json({ error: "No file data provided" });
      }

      if (!["csv", "xlsx", "xls"].includes(fileType)) {
        return res.status(400).json({ error: "Unsupported file type. Use CSV or Excel files." });
      }

      const MAX_SIZE = 5 * 1024 * 1024;
      if (fileData.length > MAX_SIZE) {
        return res.status(400).json({ error: "File too large. Maximum size is 5MB." });
      }

      const buffer = Buffer.from(fileData, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

      const MAX_ROWS = 500;
      if (jsonData.length > MAX_ROWS) {
        return res.status(400).json({ error: `Too many rows. Maximum is ${MAX_ROWS} courses per import.` });
      }

      const courseSchema = insertCourseSchema.omit({ instructorId: true });
      const validCourses: Array<{ name: string; code: string; description?: string; semester: string }> = [];
      const errors: string[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const name = String(row.name || row.Name || row.NAME || "").trim();
        const code = String(row.code || row.Code || row.CODE || "").trim();
        const semester = String(row.semester || row.Semester || row.SEMESTER || "").trim();
        const description = String(row.description || row.Description || row.DESCRIPTION || "").trim();

        const courseData = { name, code, semester, description: description || undefined };
        const result = courseSchema.safeParse(courseData);

        if (result.success) {
          validCourses.push(courseData);
        } else {
          errors.push(`Row ${i + 2}: ${result.error.errors.map(e => e.message).join(", ")}`);
        }
      }

      if (validCourses.length === 0) {
        return res.status(400).json({ 
          error: "No valid courses found in file. Required columns: name, code, semester",
          details: errors.slice(0, 10)
        });
      }

      const createdCourses = [];
      for (const courseData of validCourses) {
        try {
          const course = await storage.createCourse({
            ...courseData,
            instructorId: req.session.userId!,
          });
          createdCourses.push(course);
        } catch (err) {
          console.error("Failed to create course:", courseData.name, err);
        }
      }

      res.status(201).json({
        message: `Successfully imported ${createdCourses.length} of ${validCourses.length} valid courses`,
        imported: createdCourses.length,
        total: jsonData.length,
        valid: validCourses.length,
        courses: createdCourses,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      });
    } catch (error) {
      console.error("Import courses error:", error);
      res.status(400).json({ error: "Failed to import courses. Check file format." });
    }
  });

  app.get("/api/courses/:id", requireAuth, async (req, res) => {
    try {
      const course = await storage.getCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch course" });
    }
  });

  // Lectures
  app.get("/api/lectures", requireAuth, async (req, res) => {
    try {
      const courseId = req.query.courseId as string | undefined;
      const lectures = await storage.getLectures(courseId);
      res.json(lectures);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch lectures" });
    }
  });

  app.post("/api/lectures", requireInstructor, async (req, res) => {
    try {
      const data = insertLectureSchema.parse(req.body);
      const lecture = await storage.createLecture(data);
      res.status(201).json(lecture);
    } catch (error) {
      console.error("Create lecture error:", error);
      res.status(400).json({ error: "Failed to create lecture" });
    }
  });

  app.post("/api/lectures/:id/generate-summary", requireInstructor, async (req, res) => {
    try {
      const lecture = await storage.getLecture(req.params.id);
      if (!lecture) {
        return res.status(404).json({ error: "Lecture not found" });
      }

      const ai = await getAiClient(req.session.userId);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Analyze this lecture and provide:
1. A concise summary (2-3 paragraphs)
2. 5-7 key points as bullet points

Lecture title: ${lecture.title}
Content: ${lecture.description || "No content available"}

Respond in JSON format:
{
  "summary": "string",
  "keyPoints": ["string", "string", ...]
}`
              },
            ],
          },
        ],
      });

      const text = response.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        await storage.updateLecture(lecture.id, {
          summary: parsed.summary,
          keyPoints: parsed.keyPoints,
        });
        res.json({ success: true, ...parsed });
      } else {
        res.status(500).json({ error: "Failed to parse AI response" });
      }
    } catch (error) {
      console.error("Generate summary error:", error);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  // Quizzes
  app.get("/api/quizzes", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ error: "User not found" });
      
      if (user.role === "student") {
        const enrollments = await storage.getEnrollments(undefined, user.id);
        const quizzes = [];
        for (const e of enrollments) {
          const courseQuizzes = await storage.getQuizzes(e.courseId);
          quizzes.push(...courseQuizzes.filter(q => q.status === "published"));
        }
        return res.json(quizzes);
      }
      
      const courses = await storage.getCourses(user.role === "admin" ? undefined : user.id);
      const quizzes = [];
      for (const course of courses) {
        const courseQuizzes = await storage.getQuizzes(course.id);
        quizzes.push(...courseQuizzes);
      }
      res.json(quizzes);
    } catch (error) {
      console.error("Get quizzes error:", error);
      res.status(500).json({ error: "Failed to fetch quizzes" });
    }
  });

  app.post("/api/quizzes", requireInstructor, async (req, res) => {
    try {
      const { questions: questionInputs, ...quizData } = req.body;
      const validatedQuiz = insertQuizSchema.parse(quizData);
      
      const quiz = await storage.createQuiz(validatedQuiz);
      
      if (questionInputs && Array.isArray(questionInputs)) {
        for (let i = 0; i < questionInputs.length; i++) {
          const q = questionInputs[i];
          const question = await storage.createQuestion({
            courseId: quiz.courseId,
            type: q.type,
            text: q.text,
            options: q.options,
            correctAnswer: q.correctAnswer,
            points: q.points || 1,
            difficulty: q.difficulty || "medium",
            aiGenerated: q.id?.startsWith("ai-") || q.id?.startsWith("file-ai-") || false,
            imageUrl: q.imageUrl || null,
          });
          
          await storage.addQuizQuestion({
            quizId: quiz.id,
            questionId: question.id,
            orderIndex: i,
          });
        }
      }
      
      res.status(201).json(quiz);
    } catch (error) {
      console.error("Create quiz error:", error);
      res.status(400).json({ error: "Failed to create quiz" });
    }
  });

  app.patch("/api/quizzes/:id/publish", requireInstructor, async (req, res) => {
    try {
      const quiz = await storage.updateQuiz(req.params.id, { status: "published" });
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }
      res.json(quiz);
    } catch (error) {
      res.status(500).json({ error: "Failed to publish quiz" });
    }
  });

  app.get("/api/quiz/:id/take", requireAuth, async (req, res) => {
    try {
      const quiz = await storage.getQuiz(req.params.id);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }
      
      const quizQuestions = await storage.getQuizQuestions(quiz.id);
      const questions = quizQuestions.map(qq => ({
        id: qq.question.id,
        type: qq.question.type,
        text: qq.question.text,
        options: qq.question.options,
        points: qq.question.points,
        imageUrl: qq.question.imageUrl || null,
      }));
      
      if (quiz.randomizeQuestions) {
        questions.sort(() => Math.random() - 0.5);
      }
      
      res.json({ ...quiz, questions });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quiz" });
    }
  });

  app.post("/api/quiz/:id/start", requireAuth, async (req, res) => {
    try {
      const quiz = await storage.getQuiz(req.params.id);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }
      
      const submission = await storage.createQuizSubmission({
        quizId: quiz.id,
        studentId: req.session.userId!,
        status: "in_progress",
      });
      
      res.json({ submissionId: submission.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to start quiz" });
    }
  });

  app.post("/api/quiz/:id/submit", requireAuth, async (req, res) => {
    try {
      const { submissionId, answers } = req.body;
      const submission = await storage.getQuizSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      
      const quizQuestions = await storage.getQuizQuestions(submission.quizId);
      let totalScore = 0;
      let totalPoints = 0;
      
      const gradedAnswers = [];
      for (const answer of answers) {
        const qq = quizQuestions.find(q => q.question.id === answer.questionId);
        if (qq) {
          const isCorrect = qq.question.correctAnswer.toLowerCase() === answer.answer.toLowerCase();
          const points = isCorrect ? qq.question.points : 0;
          totalScore += points;
          totalPoints += qq.question.points;
          gradedAnswers.push({
            questionId: answer.questionId,
            answer: answer.answer,
            isCorrect,
            points,
          });
        }
      }
      
      const percentage = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;
      
      await storage.updateQuizSubmission(submissionId, {
        answers: gradedAnswers,
        score: totalScore,
        totalPoints,
        percentage,
        status: "graded",
        submittedAt: new Date(),
        gradedAt: new Date(),
      });
      
      res.json({ submissionId, score: totalScore, totalPoints, percentage });
    } catch (error) {
      console.error("Submit quiz error:", error);
      res.status(500).json({ error: "Failed to submit quiz" });
    }
  });

  // Assignments
  app.get("/api/assignments", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ error: "User not found" });
      
      if (user.role === "student") {
        const enrollments = await storage.getEnrollments(undefined, user.id);
        const assignments = [];
        for (const e of enrollments) {
          const courseAssignments = await storage.getAssignments(e.courseId);
          assignments.push(...courseAssignments.filter(a => a.status === "published"));
        }
        return res.json(assignments);
      }
      
      const courses = await storage.getCourses(user.role === "admin" ? undefined : user.id);
      const assignments = [];
      for (const course of courses) {
        const courseAssignments = await storage.getAssignments(course.id);
        assignments.push(...courseAssignments);
      }
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  });

  app.post("/api/assignments", requireInstructor, async (req, res) => {
    try {
      const data = insertAssignmentSchema.parse(req.body);
      const assignment = await storage.createAssignment(data);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Create assignment error:", error);
      res.status(400).json({ error: "Failed to create assignment" });
    }
  });

  // AI Question Generation
  app.post("/api/ai/generate-questions", requireInstructor, async (req, res) => {
    try {
      const { content, courseId, numQuestions = 5, difficulty = "mixed" } = req.body;

      const ai = await getAiClient(req.session.userId);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Generate ${numQuestions} quiz questions based on the following content. 
Mix question types (multiple choice, true/false, short answer, fill in the blank).
Difficulty level: ${difficulty}

Content:
${content}

Respond in JSON format:
{
  "questions": [
    {
      "type": "mcq" | "true_false" | "short_answer" | "fill_blank",
      "text": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"] (for MCQ only),
      "correctAnswer": "The correct answer",
      "difficulty": "easy" | "medium" | "hard",
      "points": 1-3
    }
  ]
}`
              },
            ],
          },
        ],
      });

      const text = response.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        res.json(parsed);
      } else {
        res.status(500).json({ error: "Failed to parse AI response" });
      }
    } catch (error) {
      console.error("Generate questions error:", error);
      res.status(500).json({ error: "Failed to generate questions" });
    }
  });

  app.post("/api/ai/generate-questions-from-file", requireInstructor, async (req, res) => {
    try {
      const { fileUrl, fileName, fileType, numQuestions = 5, difficulty = "mixed", courseId } = req.body;

      if (!fileUrl) {
        return res.status(400).json({ error: "File URL is required" });
      }

      const ai = await getAiClient(req.session.userId);

      const isImage = fileType?.startsWith("image/");

      let parts: any[] = [];

      if (isImage) {
        const response = await fetch(fileUrl.startsWith("/") ? `${req.protocol}://${req.get("host")}${fileUrl}` : fileUrl);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        parts = [
          {
            inlineData: {
              mimeType: fileType || "image/jpeg",
              data: base64,
            },
          },
          {
            text: `Analyze this image and generate ${numQuestions} quiz questions based on its content.
Mix question types (multiple choice, true/false, short answer, fill in the blank).
Difficulty level: ${difficulty}

Respond in JSON format:
{
  "questions": [
    {
      "type": "mcq" | "true_false" | "short_answer" | "fill_blank",
      "text": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"] (for MCQ only),
      "correctAnswer": "The correct answer",
      "difficulty": "easy" | "medium" | "hard",
      "points": 1-3
    }
  ]
}`,
          },
        ];
      } else {
        const response = await fetch(fileUrl.startsWith("/") ? `${req.protocol}://${req.get("host")}${fileUrl}` : fileUrl);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const mimeType = fileType || "application/pdf";
        parts = [
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
          {
            text: `Analyze this document (${fileName || "uploaded file"}) and generate ${numQuestions} quiz questions based on its content.
Extract key concepts, facts, and important details from the document.
Mix question types (multiple choice, true/false, short answer, fill in the blank).
Difficulty level: ${difficulty}

Respond in JSON format:
{
  "questions": [
    {
      "type": "mcq" | "true_false" | "short_answer" | "fill_blank",
      "text": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"] (for MCQ only),
      "correctAnswer": "The correct answer",
      "difficulty": "easy" | "medium" | "hard",
      "points": 1-3
    }
  ]
}`,
          },
        ];
      }

      const aiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts }],
      });

      const text = aiResponse.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        res.json(parsed);
      } else {
        res.status(500).json({ error: "Failed to parse AI response" });
      }
    } catch (error) {
      console.error("Generate from file error:", error);
      res.status(500).json({ error: "Failed to generate questions from file" });
    }
  });

  // Proctoring
  app.post("/api/proctoring/violation", requireAuth, async (req, res) => {
    try {
      const data = insertProctoringViolationSchema.parse(req.body);
      const violation = await storage.createProctoringViolation(data);
      res.status(201).json(violation);
    } catch (error) {
      console.error("Log violation error:", error);
      res.status(400).json({ error: "Failed to log violation" });
    }
  });

  app.post("/api/proctoring/analyze-frame", requireAuth, async (req, res) => {
    try {
      const { submissionId, imageData } = req.body;

      const ai = await getAiClient(req.session.userId);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Analyze this webcam frame for potential cheating behaviors in an online exam.
Look for:
1. No face visible (looking away or covering camera)
2. Multiple faces visible
3. Phone or other device visible
4. Suspicious movements (looking at another screen, reading notes)
5. Another person in frame

Return ONLY a JSON array of violations found (empty array if none):
[
  { "type": "no_face" | "multiple_faces" | "phone_detected" | "unauthorized_person" | "looking_away" | "suspicious_behavior", "description": "Brief description" }
]`
              },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: imageData.split(",")[1] || imageData,
                },
              },
            ],
          },
        ],
      });

      const text = response.text || "[]";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const violations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      
      res.json({ violations });
    } catch (error) {
      console.error("Analyze frame error:", error);
      res.json({ violations: [] });
    }
  });

  // Analytics
  app.get("/api/analytics", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || (user.role !== "instructor" && user.role !== "admin")) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const stats = await storage.getDashboardStats(user.id);
      res.json({
        overview: stats,
        scoreDistribution: [
          { range: "0-20", count: 5 },
          { range: "21-40", count: 12 },
          { range: "41-60", count: 28 },
          { range: "61-80", count: 65 },
          { range: "81-100", count: 46 },
        ],
        performanceTrend: [],
        topPerformers: [],
        lowPerformers: [],
        quizStats: [],
        violationStats: [],
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Student specific endpoints
  app.get("/api/student/quizzes/upcoming", requireAuth, async (req, res) => {
    try {
      const enrollments = await storage.getEnrollments(undefined, req.session.userId);
      const quizzes = [];
      for (const e of enrollments) {
        const courseQuizzes = await storage.getQuizzes(e.courseId);
        quizzes.push(...courseQuizzes.filter(q => q.status === "published"));
      }
      res.json(quizzes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch upcoming quizzes" });
    }
  });

  app.get("/api/student/assignments/pending", requireAuth, async (req, res) => {
    try {
      const enrollments = await storage.getEnrollments(undefined, req.session.userId);
      const assignments = [];
      for (const e of enrollments) {
        const courseAssignments = await storage.getAssignments(e.courseId);
        assignments.push(...courseAssignments.filter(a => a.status === "published"));
      }
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending assignments" });
    }
  });

  // Public Quiz Link Generation
  app.post("/api/quizzes/:id/generate-public-link", requireInstructor, async (req, res) => {
    try {
      const { id } = req.params;
      const { permission, requiredFields } = req.body;
      
      const quiz = await storage.getQuiz(id);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }
      
      const updated = await storage.generateQuizPublicLink(
        id, 
        permission || "view", 
        requiredFields || ["name", "email"]
      );
      
      if (updated) {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const publicUrl = `${baseUrl}/public/quiz/${updated.publicAccessToken}`;
        res.json({ quiz: updated, publicUrl });
      } else {
        res.status(500).json({ error: "Failed to generate public link" });
      }
    } catch (error) {
      console.error("Generate public link error:", error);
      res.status(500).json({ error: "Failed to generate public link" });
    }
  });

  // Disable public link
  app.post("/api/quizzes/:id/disable-public-link", requireInstructor, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await storage.updateQuiz(id, { 
        publicLinkEnabled: false,
        publicAccessToken: null 
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to disable public link" });
    }
  });

  // Public Quiz Access (no auth required)
  app.get("/api/public/quiz/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const quiz = await storage.getQuizByPublicToken(token);
      
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found or link expired" });
      }
      
      const quizQuestions = await storage.getQuizQuestions(quiz.id);
      
      // Don't include correct answers for attempt mode
      const sanitizedQuestions = quiz.publicLinkPermission === "view" 
        ? quizQuestions 
        : quizQuestions.map(qq => ({
            ...qq,
            question: {
              ...qq.question,
              correctAnswer: undefined,
              explanation: undefined,
            }
          }));
      
      res.json({
        quiz: {
          ...quiz,
          publicAccessToken: undefined, // Don't expose token
        },
        questions: sanitizedQuestions,
        requiredFields: quiz.requiredIdentificationFields || ["name", "email"],
        canAttempt: quiz.publicLinkPermission === "attempt",
      });
    } catch (error) {
      console.error("Public quiz access error:", error);
      res.status(500).json({ error: "Failed to access quiz" });
    }
  });

  // Submit public quiz
  app.post("/api/public/quiz/:token/submit", async (req, res) => {
    try {
      const { token } = req.params;
      const { identificationData, answers } = req.body;
      
      const quiz = await storage.getQuizByPublicToken(token);
      if (!quiz || quiz.publicLinkPermission !== "attempt") {
        return res.status(403).json({ error: "Quiz submission not allowed" });
      }
      
      // Calculate score
      const quizQuestions = await storage.getQuizQuestions(quiz.id);
      let score = 0;
      let totalPoints = 0;
      
      const gradedAnswers = answers.map((ans: { questionId: string; answer: string }) => {
        const qq = quizQuestions.find(q => q.questionId === ans.questionId);
        if (qq) {
          totalPoints += qq.question.points;
          const isCorrect = qq.question.correctAnswer === ans.answer;
          if (isCorrect) score += qq.question.points;
          return { ...ans, isCorrect, points: isCorrect ? qq.question.points : 0 };
        }
        return ans;
      });
      
      const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
      
      const submission = await storage.createPublicQuizSubmission({
        quizId: quiz.id,
        identificationData,
        answers: gradedAnswers,
        score,
        totalPoints,
        percentage,
        status: "submitted",
        submittedAt: new Date(),
        ipAddress: req.ip,
      });
      
      res.json({
        submission,
        score,
        totalPoints,
        percentage,
        passed: percentage >= (quiz.passingScore || 60),
      });
    } catch (error) {
      console.error("Public quiz submit error:", error);
      res.status(500).json({ error: "Failed to submit quiz" });
    }
  });

  // Get public submissions for a quiz (instructor only)
  app.get("/api/quizzes/:id/public-submissions", requireInstructor, async (req, res) => {
    try {
      const { id } = req.params;
      const submissions = await storage.getPublicQuizSubmissions(id);
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch public submissions" });
    }
  });

  // Agentic Co-pilot Endpoints
  app.post("/api/chat/command", requireInstructor, async (req, res) => {
    try {
      const { command } = req.body;
      const userId = req.session.userId!;
      
      const chatCommand = await storage.createChatCommand({
        userId,
        command,
        status: "executing",
      });
      
      const intentPrompt = `You are an AI co-pilot for an educational assessment platform called EduAssess AI. You help instructors and admins manage their platform.

Analyze this user command and extract ALL intents. The user may request MULTIPLE tasks in a single message. You must detect and return ALL of them as an ordered array.

Return a JSON object with:
- tasks: an array of task objects, each containing:
  - intent: one of these exact values:
    "create_quiz", "create_course", "create_assignment", "create_lecture",
    "list_quizzes", "list_courses", "list_assignments", "list_lectures", "list_enrollments", "list_submissions",
    "publish_quiz", "delete_quiz", "delete_course", "delete_assignment", "delete_lecture",
    "generate_public_link", "view_analytics",
    "navigate", "help", "unknown"
  - parameters: relevant extracted parameters. Examples:
    - For create_course: name, code, semester, description
    - For create_quiz: title, topic, courseName, numQuestions, difficulty, generateQuestions (true if user wants AI-generated questions)
    - For create_assignment: title, courseName, dueDate, points, description
    - For create_lecture: title, courseName, unit, description
    - For delete/publish: name or title of the target resource
    - For navigate: page (one of: dashboard, courses, quizzes, assignments, lectures, analytics, quiz-builder)
    - For generate_public_link: quizName, permission ("view" or "attempt")
    - For list_submissions: quizName
    - For list_enrollments: courseName
- message: a brief human-friendly summary of ALL actions you'll perform

IMPORTANT RULES:
- If the user says "create a course X and then create a quiz Y on topic Z", return TWO tasks: create_course + create_quiz.
- If the user says "create a quiz on topic X", set generateQuestions=true and include the topic so AI questions are auto-generated.
- If you see keywords like "and", "then", "also", "plus" connecting different actions, split them into separate tasks.
- Order tasks logically: create courses before quizzes/assignments that depend on them.
- If a quiz references a course being created in the same message, use the SAME course name in the quiz's courseName parameter.

User command: "${command}"

Return only valid JSON, no markdown.`;

      const ai = await getAiClient(userId);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: intentPrompt,
      });
      
      const responseText = response.text || "";
      
      let parsed: { tasks: Array<{ intent: string; parameters: any }>; message: string };
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const raw = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
        if (raw.tasks && Array.isArray(raw.tasks)) {
          parsed = raw;
        } else if (raw.intent) {
          parsed = { tasks: [{ intent: raw.intent, parameters: raw.parameters || {} }], message: raw.message || "" };
        } else {
          parsed = { tasks: [{ intent: "unknown", parameters: {} }], message: raw.message || "" };
        }
      } catch {
        parsed = { tasks: [{ intent: "unknown", parameters: {} }], message: "I couldn't understand that. Try commands like 'create a course', 'list quizzes', or 'show analytics'." };
      }

      const user = await storage.getUser(userId);
      const isAdmin = user?.role === "admin";

      const refreshCourses = async () => {
        const courses = await storage.getCourses(userId);
        return courses;
      };

      const findCourse = async (name?: string) => {
        const courses = await refreshCourses();
        if (name) {
          const match = courses.find(c => c.name.toLowerCase().includes(name.toLowerCase()) || c.code.toLowerCase().includes(name.toLowerCase()));
          if (match) return match;
        }
        return courses[0];
      };

      const findMyQuiz = async (name?: string) => {
        const courses = await refreshCourses();
        const courseIds = new Set(courses.map(c => c.id));
        const allQuizzes = await storage.getQuizzes();
        const myQuizzes = isAdmin ? allQuizzes : allQuizzes.filter(q => courseIds.has(q.courseId));
        if (name) {
          const match = myQuizzes.find(q => q.title.toLowerCase().includes(name.toLowerCase()));
          if (match) return match;
        }
        return myQuizzes[myQuizzes.length - 1];
      };

      const getMyQuizzes = async () => {
        const courses = await refreshCourses();
        const courseIds = new Set(courses.map(c => c.id));
        const allQuizzes = await storage.getQuizzes();
        return isAdmin ? allQuizzes : allQuizzes.filter(q => courseIds.has(q.courseId));
      };

      const getMyAssignments = async () => {
        const courses = await refreshCourses();
        const courseIds = new Set(courses.map(c => c.id));
        const allAssignments = await storage.getAssignments();
        return isAdmin ? allAssignments : allAssignments.filter(a => courseIds.has(a.courseId));
      };

      const getMyLectures = async () => {
        const courses = await refreshCourses();
        const courseIds = new Set(courses.map(c => c.id));
        const allLectures = await storage.getLectures();
        return isAdmin ? allLectures : allLectures.filter(l => courseIds.has(l.courseId));
      };

      const executeTask = async (intent: string, params: any): Promise<{ success: boolean; message: string; data?: any }> => {
        if (intent === "create_course") {
          const course = await storage.createCourse({
            name: params.name || params.title || "New Course",
            code: params.code || `COURSE${Math.floor(100 + Math.random() * 900)}`,
            semester: params.semester || "Spring 2026",
            description: params.description || "",
            instructorId: userId,
          });
          return { success: true, message: `Created course "${course.name}" (${course.code})`, data: { course } };

        } else if (intent === "create_quiz") {
          const course = await findCourse(params.courseName || params.course);
          if (!course) {
            return { success: false, message: "No courses found. Create a course first before adding quizzes." };
          }
          const quizTitle = params.title || params.name || params.topic || "New Quiz";
          const quiz = await storage.createQuiz({
            courseId: course.id,
            title: quizTitle,
            description: params.description || `Quiz on ${params.topic || quizTitle}`,
            status: "draft",
          });

          if (params.generateQuestions || params.topic) {
            try {
              const topic = params.topic || params.title || params.name || quizTitle;
              const numQuestions = params.numQuestions || 5;
              const difficulty = params.difficulty || "mixed";
              const genPrompt = `Generate ${numQuestions} quiz questions about "${topic}".
Return a JSON object with a "questions" array. Each question should have:
- type: one of "mcq", "true_false", "short_answer", "fill_blank"
- text: the question text
- options: array of options (for mcq, 4 options; for true_false use ["True","False"]; empty array for others)
- correctAnswer: the correct answer string
- difficulty: "${difficulty === "mixed" ? "easy, medium, or hard (vary them)" : difficulty}"
- points: 1 for easy, 2 for medium, 3 for hard

Make questions clear, educational, and varied in type.
Return only valid JSON, no markdown.`;

              const genResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: genPrompt,
              });
              const genText = genResponse.text || "";
              const genMatch = genText.match(/\{[\s\S]*\}/);
              if (genMatch) {
                const genParsed = JSON.parse(genMatch[0]);
                if (genParsed.questions && Array.isArray(genParsed.questions)) {
                  for (let qi = 0; qi < genParsed.questions.length; qi++) {
                    const q = genParsed.questions[qi];
                    const question = await storage.createQuestion({
                      courseId: course.id,
                      type: q.type || "mcq",
                      text: q.text,
                      options: q.options || [],
                      correctAnswer: q.correctAnswer || "",
                      points: q.points || 1,
                      difficulty: q.difficulty || "medium",
                      aiGenerated: true,
                    });
                    await storage.addQuizQuestion({
                      quizId: quiz.id,
                      questionId: question.id,
                      orderIndex: qi,
                    });
                  }
                  return {
                    success: true,
                    message: `Created quiz "${quiz.title}" in "${course.name}" with ${genParsed.questions.length} AI-generated questions`,
                    data: { quiz, questionsGenerated: genParsed.questions.length, navigateTo: "/quizzes" },
                  };
                }
              }
            } catch (genErr) {
              console.error("AI question generation in chatbot failed:", genErr);
            }
          }

          return { success: true, message: `Created quiz "${quiz.title}" in "${course.name}". You can add questions in the Quiz Builder.`, data: { quiz, navigateTo: "/quizzes" } };

        } else if (intent === "create_assignment") {
          const course = await findCourse(params.courseName);
          if (!course) return { success: false, message: "No courses found. Create a course first." };
          const assignment = await storage.createAssignment({
            courseId: course.id,
            title: params.title || params.name || "New Assignment",
            description: params.description || "Created via Co-pilot",
            dueDate: params.dueDate ? new Date(params.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            maxScore: params.points ? parseInt(params.points) : 100,
            status: "draft",
          });
          return { success: true, message: `Created assignment "${assignment.title}" in "${course.name}" (due ${assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : "in 7 days"})`, data: { assignment } };

        } else if (intent === "create_lecture") {
          const course = await findCourse(params.courseName);
          if (!course) return { success: false, message: "No courses found. Create a course first." };
          const lecture = await storage.createLecture({
            courseId: course.id,
            title: params.title || params.name || "New Lecture",
            description: params.description || "Created via Co-pilot",
            unit: params.unit || "Unit 1",
          });
          return { success: true, message: `Created lecture "${lecture.title}" in "${course.name}"`, data: { lecture } };

        } else if (intent === "publish_quiz") {
          const quiz = await findMyQuiz(params.title || params.name || params.quizName);
          if (!quiz) return { success: false, message: "No quizzes found to publish." };
          const updated = await storage.updateQuiz(quiz.id, { status: "published" });
          return { success: true, message: `Published quiz "${quiz.title}". Students can now take it.`, data: { quiz: updated } };

        } else if (intent === "delete_quiz") {
          const quiz = await findMyQuiz(params.title || params.name || params.quizName);
          if (!quiz) return { success: false, message: "No matching quiz found to delete." };
          await storage.deleteQuiz(quiz.id);
          return { success: true, message: `Deleted quiz "${quiz.title}"`, data: { deleted: true } };

        } else if (intent === "delete_course") {
          const course = await findCourse(params.name || params.title || params.courseName);
          if (!course) return { success: false, message: "No matching course found to delete." };
          await storage.deleteCourse(course.id);
          return { success: true, message: `Deleted course "${course.name}" (${course.code})`, data: { deleted: true } };

        } else if (intent === "delete_assignment") {
          const myAssignments = await getMyAssignments();
          const target = params.title || params.name || "";
          const match = target ? myAssignments.find(a => a.title.toLowerCase().includes(target.toLowerCase())) : myAssignments[myAssignments.length - 1];
          if (!match) return { success: false, message: "No assignments found to delete." };
          await storage.deleteAssignment(match.id);
          return { success: true, message: `Deleted assignment "${match.title}"`, data: { deleted: true } };

        } else if (intent === "delete_lecture") {
          const myLectures = await getMyLectures();
          const target = params.title || params.name || "";
          const match = target ? myLectures.find(l => l.title.toLowerCase().includes(target.toLowerCase())) : myLectures[myLectures.length - 1];
          if (!match) return { success: false, message: "No lectures found to delete." };
          await storage.deleteLecture(match.id);
          return { success: true, message: `Deleted lecture "${match.title}"`, data: { deleted: true } };

        } else if (intent === "generate_public_link") {
          const quiz = await findMyQuiz(params.quizName || params.title || params.name);
          if (!quiz) return { success: false, message: "No quizzes found to generate a link for." };
          const permission = params.permission === "view" ? "view" : "attempt";
          const updated = await storage.generateQuizPublicLink(quiz.id, permission, ["name", "email"]);
          if (!updated) return { success: false, message: "Failed to generate public link." };
          return { success: true, message: `Generated ${permission}-only public link for "${quiz.title}"`, data: { quiz: updated } };

        } else if (intent === "list_quizzes") {
          const myQuizzes = await getMyQuizzes();
          return { success: true, message: `Found ${myQuizzes.length} quizzes`, data: { quizzes: myQuizzes.slice(0, 10) } };

        } else if (intent === "list_courses") {
          const courses = await refreshCourses();
          return { success: true, message: `Found ${courses.length} courses`, data: { courses } };

        } else if (intent === "list_assignments") {
          const myAssignments = await getMyAssignments();
          return { success: true, message: `Found ${myAssignments.length} assignments`, data: { assignments: myAssignments.slice(0, 10) } };

        } else if (intent === "list_lectures") {
          const myLectures = await getMyLectures();
          return { success: true, message: `Found ${myLectures.length} lectures`, data: { lectures: myLectures.slice(0, 10) } };

        } else if (intent === "list_enrollments") {
          const course = await findCourse(params.courseName);
          if (!course) return { success: false, message: "No courses found." };
          const enrollments = await storage.getEnrollments(course.id);
          return { success: true, message: `Found ${enrollments.length} enrolled students in "${course.name}"`, data: { enrollments } };

        } else if (intent === "list_submissions") {
          const quiz = await findMyQuiz(params.quizName || params.title);
          if (!quiz) return { success: false, message: "No quizzes found." };
          const submissions = await storage.getQuizSubmissions(quiz.id);
          return { success: true, message: `Found ${submissions.length} submissions for "${quiz.title}"`, data: { submissions: submissions.slice(0, 10) } };

        } else if (intent === "view_analytics") {
          const stats = await storage.getDashboardStats(userId);
          return { success: true, message: "Here are your analytics", data: { stats } };

        } else if (intent === "navigate") {
          const pageMap: Record<string, string> = {
            dashboard: "/dashboard",
            courses: "/courses",
            quizzes: "/quizzes",
            assignments: "/assignments",
            lectures: "/lectures",
            analytics: "/analytics",
            "quiz-builder": "/quizzes/new",
            "quiz builder": "/quizzes/new",
            "new quiz": "/quizzes/new",
          };
          const page = params.page?.toLowerCase() || "";
          const path = pageMap[page] || "/dashboard";
          return { success: true, message: `Navigating to ${page || "dashboard"}`, data: { navigateTo: path } };

        } else if (intent === "help") {
          return {
            success: true,
            message: "Here's what I can do for you:\n\n" +
              "**Courses:** Create, list, delete courses\n" +
              "**Quizzes:** Create quizzes with AI-generated questions, publish, delete, generate public links\n" +
              "**Assignments:** Create, list, delete assignments\n" +
              "**Lectures:** Create, list, delete lectures\n" +
              "**Analytics:** View dashboard stats, quiz submissions\n" +
              "**Navigation:** Go to any page (e.g., 'take me to quizzes')\n\n" +
              "You can combine multiple tasks in one message! For example:\n" +
              "- 'Create a course called Biology and add a quiz on cell division'\n" +
              "- 'List all my courses and show analytics'\n" +
              "- 'Create a course Math 101, add a quiz on algebra, and publish it'",
          };

        } else {
          return {
            success: true,
            message: parsed.message || "I'm not sure what you need. Try saying things like:\n- 'Create a course called Biology 101'\n- 'Create a course and add a quiz on photosynthesis'\n- 'Publish my latest quiz'\n- 'Show my analytics'",
          };
        }
      };

      const taskResults: Array<{ intent: string; result: { success: boolean; message: string; data?: any } }> = [];
      let lastCreatedCourseName: string | null = null;
      
      for (const task of parsed.tasks) {
        const taskParams = { ...(task.parameters || {}) };
        if (lastCreatedCourseName && !taskParams.courseName && !taskParams.course) {
          if (["create_quiz", "create_assignment", "create_lecture"].includes(task.intent)) {
            taskParams.courseName = lastCreatedCourseName;
          }
        }
        const taskResult = await executeTask(task.intent, taskParams);
        taskResults.push({ intent: task.intent, result: taskResult });
        if (task.intent === "create_course" && taskResult.success && taskResult.data?.course) {
          lastCreatedCourseName = taskResult.data.course.name;
        }
      }

      const allSucceeded = taskResults.every(t => t.result.success);
      const combinedMessage = taskResults.map((t, i) => {
        const prefix = parsed.tasks.length > 1 ? `${i + 1}. ` : "";
        return `${prefix}${t.result.message}`;
      }).join("\n");

      const combinedData: any = {};
      for (const t of taskResults) {
        if (t.result.data) {
          Object.assign(combinedData, t.result.data);
        }
      }

      const result = {
        success: allSucceeded || taskResults.some(t => t.result.success),
        message: combinedMessage,
        data: Object.keys(combinedData).length > 0 ? combinedData : undefined,
        taskResults,
      };
      
      await storage.updateChatCommand(chatCommand.id, {
        intent: parsed.tasks.map(t => t.intent).join("+"),
        parameters: parsed.tasks.map(t => t.parameters),
        status: result.success ? "completed" : "failed",
        result,
        completedAt: new Date(),
      });
      
      res.json({ command: chatCommand, result, aiResponse: parsed.message });
    } catch (error) {
      console.error("Chat command error:", error);
      res.status(500).json({ error: "Failed to process command" });
    }
  });

  // Get chat history
  app.get("/api/chat/history", requireAuth, async (req, res) => {
    try {
      const commands = await storage.getChatCommands(req.session.userId!);
      res.json(commands);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chat history" });
    }
  });

  return httpServer;
}
