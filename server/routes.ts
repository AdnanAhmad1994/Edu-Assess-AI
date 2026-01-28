import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { GoogleGenAI } from "@google/genai";
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

  return httpServer;
}
