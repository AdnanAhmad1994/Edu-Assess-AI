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

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

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
      const { password: _, ...userWithoutPassword } = user;
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
      const { password: _, ...userWithoutPassword } = user;
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

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
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
            aiGenerated: q.id?.startsWith("ai-") || false,
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

  // Agentic Chatbot Endpoints
  app.post("/api/chat/command", requireAuth, async (req, res) => {
    try {
      const { command } = req.body;
      const userId = req.session.userId!;
      
      // Create command record
      const chatCommand = await storage.createChatCommand({
        userId,
        command,
        status: "executing",
      });
      
      // Parse intent using Gemini
      const intentPrompt = `You are an AI assistant for an educational assessment platform called EduAssess AI.
      
Analyze this user command and extract the intent and parameters. Return a JSON object with:
- intent: one of "create_quiz", "create_course", "generate_public_link", "view_analytics", "list_quizzes", "list_courses", "upload_content", "unknown"
- parameters: relevant extracted parameters like title, courseId, permission level, etc.
- message: a brief confirmation message of what you'll do

User command: "${command}"

Return only valid JSON, no markdown.`;

      const model = ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: intentPrompt,
      });
      
      const response = await model;
      const responseText = response.text || "";
      
      let parsed;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      } catch {
        parsed = { intent: "unknown", parameters: {}, message: "I couldn't understand that command. Try asking me to create a quiz or generate a public link." };
      }
      
      // Execute the command based on intent
      let result: { success: boolean; message: string; data?: any } = { 
        success: false, 
        message: "Unknown command" 
      };
      
      if (parsed.intent === "create_quiz") {
        const courses = await storage.getCourses(userId);
        if (courses.length > 0) {
          const quiz = await storage.createQuiz({
            courseId: courses[0].id,
            title: parsed.parameters.title || "AI Generated Quiz",
            description: parsed.parameters.description || "Created via AI assistant",
            status: "draft",
          });
          result = { 
            success: true, 
            message: `Created quiz "${quiz.title}" in course "${courses[0].name}"`,
            data: { quiz }
          };
        } else {
          result = { success: false, message: "No courses found. Please create a course first." };
        }
      } else if (parsed.intent === "create_course") {
        const course = await storage.createCourse({
          name: parsed.parameters.name || "New Course",
          code: parsed.parameters.code || "COURSE101",
          semester: parsed.parameters.semester || "Spring 2026",
          instructorId: userId,
        });
        result = { 
          success: true, 
          message: `Created course "${course.name}" (${course.code})`,
          data: { course }
        };
      } else if (parsed.intent === "generate_public_link") {
        const quizzes = await storage.getQuizzes();
        const targetQuiz = quizzes.find(q => 
          q.title.toLowerCase().includes((parsed.parameters.quizName || "").toLowerCase())
        ) || quizzes[0];
        
        if (targetQuiz) {
          const permission = parsed.parameters.permission === "view" ? "view" : "attempt";
          const updated = await storage.generateQuizPublicLink(
            targetQuiz.id,
            permission,
            ["name", "email"]
          );
          if (updated) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const publicUrl = `${baseUrl}/public/quiz/${updated.publicAccessToken}`;
            result = { 
              success: true, 
              message: `Generated ${permission}-only public link for "${targetQuiz.title}"`,
              data: { publicUrl, quiz: updated }
            };
          }
        } else {
          result = { success: false, message: "No quizzes found to generate a link for." };
        }
      } else if (parsed.intent === "list_quizzes") {
        const quizzes = await storage.getQuizzes();
        result = { 
          success: true, 
          message: `Found ${quizzes.length} quizzes`,
          data: { quizzes: quizzes.slice(0, 10) }
        };
      } else if (parsed.intent === "list_courses") {
        const courses = await storage.getCourses(userId);
        result = { 
          success: true, 
          message: `Found ${courses.length} courses`,
          data: { courses }
        };
      } else if (parsed.intent === "view_analytics") {
        const stats = await storage.getDashboardStats(userId);
        result = { 
          success: true, 
          message: "Here are your analytics",
          data: { stats }
        };
      } else {
        result = { 
          success: true, 
          message: parsed.message || "I understood your request. How can I help you with EduAssess AI?",
          data: { parsed }
        };
      }
      
      // Update command with result
      await storage.updateChatCommand(chatCommand.id, {
        intent: parsed.intent,
        parameters: parsed.parameters,
        status: result.success ? "completed" : "failed",
        result,
        completedAt: new Date(),
      });
      
      res.json({
        command: chatCommand,
        result,
        aiResponse: parsed.message,
      });
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
