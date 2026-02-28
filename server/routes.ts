import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import MemoryStore from "memorystore";
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
  type User,
  type AiProvider,
  AI_PROVIDERS,
} from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendPasswordResetEmail, sendUsernameReminderEmail } from "./email";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import { generateWithProvider, testProviderKey, PROVIDER_CONFIGS } from "./aiProvider";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

// Keep a legacy Gemini client for routes that haven't been migrated yet
const platformAi = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "placeholder",
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

/** Legacy helper – returns a GoogleGenAI instance (Gemini-only routes) */
async function getAiClient(userId?: string): Promise<GoogleGenAI> {
  if (userId) {
    const user = await storage.getUser(userId);
    if (user?.geminiApiKey) {
      return new GoogleGenAI({ apiKey: user.geminiApiKey });
    }
  }
  return platformAi;
}

/** Universal helper – uses the user's active provider (all AI routes should use this) */
async function getAiUser(userId?: string) {
  if (!userId) return undefined;
  return storage.getUser(userId);
}

/** Strip all sensitive key fields before sending user object to client */
function sanitizeUser(user: User) {
  const {
    password: _pw, patternHash: _ph,
    geminiApiKey: _g, openaiApiKey: _oa, openrouterApiKey: _or,
    grokApiKey: _gk, kimiApiKey: _ki, anthropicApiKey: _an,
    customApiKey: _cu,
    ...safe
  } = user;
  return {
    ...safe,
    hasGeminiKey: !!user.geminiApiKey,
    hasOpenaiKey: !!user.openaiApiKey,
    hasOpenrouterKey: !!user.openrouterApiKey,
    hasGrokKey: !!user.grokApiKey,
    hasKimiKey: !!user.kimiApiKey,
    hasAnthropicKey: !!user.anthropicApiKey,
    hasCustomKey: !!user.customApiKey,
    hasPattern: !!user.patternHash,
    activeAiProvider: user.activeAiProvider || "gemini",
  };
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
  
  // Session store: PostgreSQL when DATABASE_URL is set (production), else in-memory (local dev)
  let sessionStore: session.Store;
  if (process.env.DATABASE_URL) {
    const PgSession = connectPgSimple(session);
    sessionStore = new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "session",
      createTableIfMissing: true,
    });
  } else {
    const MStore = MemoryStore(session);
    sessionStore = new MStore({ checkPeriod: 86400000 });
  }

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "eduassess-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  registerObjectStorageRoutes(app);

  // Seed default admin account if none exists
  let adminUser = await storage.getUserByUsername("admin");
  if (!adminUser) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    adminUser = await storage.createUser({
      username: "admin",
      password: hashedPassword,
      email: "admin@eduassess.ai",
      name: "Administrator",
      role: "admin",
    });
    console.log("Default admin account created (username: admin, password: admin123)");
  }

  // Auto-apply AI provider keys from environment variables on startup
  // This allows persistent key config via env vars even with in-memory storage
  const envOpenrouterKey = process.env.OPENROUTER_API_KEY;
  const envGeminiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const envOpenaiKey = process.env.OPENAI_API_KEY;
  if (adminUser && (envOpenrouterKey || envGeminiKey || envOpenaiKey)) {
    const keyUpdate: Partial<typeof adminUser> = {};
    if (envOpenrouterKey) {
      keyUpdate.openrouterApiKey = envOpenrouterKey;
      keyUpdate.activeAiProvider = "openrouter";
    } else if (envGeminiKey) {
      keyUpdate.geminiApiKey = envGeminiKey;
      keyUpdate.activeAiProvider = "gemini";
    } else if (envOpenaiKey) {
      keyUpdate.openaiApiKey = envOpenaiKey;
      keyUpdate.activeAiProvider = "openai";
    }
    await storage.updateUser(adminUser.id, keyUpdate);
    console.log(`AI provider auto-configured from env: ${keyUpdate.activeAiProvider}`);
  }

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);

      // Enforce minimum length constraints not expressed in DB schema
      if (!data.username || data.username.trim().length < 3) {
        return res.status(400).json({ error: "Username must be at least 3 characters" });
      }
      if (!data.password || data.password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

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
      res.status(201).json(sanitizeUser(user));
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
      res.json(sanitizeUser(user));
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
    res.json(sanitizeUser(user));
  });

  // Admin - User Management
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const role = req.query.role as string | undefined;
      const users = await storage.getUsers(role);
      res.json(users.map(sanitizeUser));
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
      res.status(201).json(sanitizeUser(user));
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
      res.json(sanitizeUser(updated));
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
  // ── Legacy Gemini key route (kept for backwards compat) ──────────────────
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

  // ── Multi-provider AI settings ──────────────────────────────────────────────

  /** GET /api/settings/ai-providers
   *  Returns per-provider key status (masked) + active provider */
  app.get("/api/settings/ai-providers", requireInstructor, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });

      const mask = (k: string | null | undefined) =>
        k ? k.slice(0, 6) + "..." + k.slice(-4) : null;

      res.json({
        activeProvider: user.activeAiProvider || "gemini",
        providers: {
          gemini:      { hasKey: !!user.geminiApiKey,      maskedKey: mask(user.geminiApiKey) },
          openai:      { hasKey: !!user.openaiApiKey,      maskedKey: mask(user.openaiApiKey) },
          openrouter:  { hasKey: !!user.openrouterApiKey,  maskedKey: mask(user.openrouterApiKey) },
          grok:        { hasKey: !!user.grokApiKey,        maskedKey: mask(user.grokApiKey) },
          kimi:        { hasKey: !!user.kimiApiKey,        maskedKey: mask(user.kimiApiKey) },
          anthropic:   { hasKey: !!user.anthropicApiKey,   maskedKey: mask(user.anthropicApiKey) },
          custom:      {
            hasKey: !!user.customApiKey || !!user.customApiBaseUrl,
            maskedKey: mask(user.customApiKey),
            baseUrl: user.customApiBaseUrl || null,
            model: user.customApiModel || null,
          },
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch AI provider settings" });
    }
  });

  /** PUT /api/settings/ai-providers
   *  Save one or more provider keys + set active provider */
  app.put("/api/settings/ai-providers", requireInstructor, async (req, res) => {
    try {
      const {
        activeProvider,
        geminiApiKey, openaiApiKey, openrouterApiKey,
        grokApiKey, kimiApiKey, anthropicApiKey,
        customApiKey, customApiBaseUrl, customApiModel,
      } = req.body;

      // Validate provider value if given
      if (activeProvider && !AI_PROVIDERS.includes(activeProvider as AiProvider)) {
        return res.status(400).json({ error: "Invalid provider. Valid options: " + AI_PROVIDERS.join(", ") });
      }

      const updateData: Partial<User> = {};
      if (activeProvider !== undefined)      updateData.activeAiProvider   = activeProvider;
      if (geminiApiKey !== undefined)        updateData.geminiApiKey       = geminiApiKey || null;
      if (openaiApiKey !== undefined)        updateData.openaiApiKey       = openaiApiKey || null;
      if (openrouterApiKey !== undefined)    updateData.openrouterApiKey   = openrouterApiKey || null;
      if (grokApiKey !== undefined)          updateData.grokApiKey         = grokApiKey || null;
      if (kimiApiKey !== undefined)          updateData.kimiApiKey         = kimiApiKey || null;
      if (anthropicApiKey !== undefined)     updateData.anthropicApiKey    = anthropicApiKey || null;
      if (customApiKey !== undefined)        updateData.customApiKey       = customApiKey || null;
      if (customApiBaseUrl !== undefined)    updateData.customApiBaseUrl   = customApiBaseUrl || null;
      if (customApiModel !== undefined)      updateData.customApiModel     = customApiModel || null;

      const updated = await storage.updateUser(req.session.userId!, updateData);
      if (!updated) return res.status(404).json({ error: "User not found" });

      res.json({ success: true, activeProvider: updated.activeAiProvider || "gemini" });
    } catch (error) {
      console.error("Update AI providers error:", error);
      res.status(500).json({ error: "Failed to update AI provider settings" });
    }
  });

  /** POST /api/settings/test-ai-provider
   *  Test that a given provider key actually works */
  app.post("/api/settings/test-ai-provider", requireInstructor, async (req, res) => {
    try {
      const { provider, apiKey, baseUrl, model } = req.body;
      if (!provider) return res.status(400).json({ error: "provider is required" });

      const keyFields: Record<string, string | undefined> = {};
      if (provider === "gemini")     keyFields.geminiApiKey     = apiKey;
      if (provider === "openai")     keyFields.openaiApiKey     = apiKey;
      if (provider === "openrouter") keyFields.openrouterApiKey = apiKey;
      if (provider === "grok")       keyFields.grokApiKey       = apiKey;
      if (provider === "kimi")       keyFields.kimiApiKey       = apiKey;
      if (provider === "anthropic")  keyFields.anthropicApiKey  = apiKey;
      if (provider === "custom") {
        keyFields.customApiKey     = apiKey;
        keyFields.customApiBaseUrl = baseUrl;
        keyFields.customApiModel   = model;
      }

      const result = await testProviderKey(provider as AiProvider, keyFields);
      res.json({
        valid: result.success,
        provider,
        model: result.model,
        message: result.success
          ? `✅ ${PROVIDER_CONFIGS[provider as AiProvider]?.label || provider} is working`
          : `❌ ${result.error || "Key validation failed"}`,
      });
    } catch (error: any) {
      res.json({ valid: false, message: error.message || "Test failed" });
    }
  });

  // Legacy Gemini test (kept for any existing front-end calls)
  app.post("/api/settings/test-gemini-key", requireInstructor, async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey) return res.status(400).json({ error: "API key required" });
      const result = await testProviderKey("gemini", { geminiApiKey: apiKey });
      res.json({ valid: result.success, message: result.success ? "API key is working" : result.error });
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
      res.json(sanitizeUser(user));
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
      if (!data.name || data.name.trim().length < 3) {
        return res.status(400).json({ error: "Course name must be at least 3 characters" });
      }
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

  // Update a course (instructor/admin only) — owner or admin only
  app.put("/api/courses/:id", requireInstructor, async (req, res) => {
    try {
      const course = await storage.getCourse(req.params.id as string);
      if (!course) return res.status(404).json({ error: "Course not found" });
      const requestingUser = await storage.getUser(req.session.userId!);
      if (requestingUser?.role !== "admin" && course.instructorId !== req.session.userId) {
        return res.status(403).json({ error: "You do not own this course" });
      }
      const updated = await storage.updateCourse(req.params.id as string, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update course" });
    }
  });

  // Delete a course (instructor/admin only) — owner or admin only
  app.delete("/api/courses/:id", requireInstructor, async (req, res) => {
    try {
      const course = await storage.getCourse(req.params.id as string);
      if (!course) return res.status(404).json({ error: "Course not found" });
      const requestingUser = await storage.getUser(req.session.userId!);
      if (requestingUser?.role !== "admin" && course.instructorId !== req.session.userId) {
        return res.status(403).json({ error: "You do not own this course" });
      }
      await storage.deleteCourse(req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete course" });
    }
  });

  // Enroll a student in a course (instructor/admin only)
  app.post("/api/courses/:id/enroll", requireInstructor, async (req, res) => {
    try {
      const courseId = req.params.id as string;
      const { studentId, studentEmail } = req.body;

      let resolvedStudentId = studentId;
      // If email provided instead of ID, look up the user
      if (!resolvedStudentId && studentEmail) {
        const users = await storage.getUsers();
        const found = users.find((u: any) => u.email === studentEmail);
        if (!found) return res.status(404).json({ error: "Student not found with that email" });
        resolvedStudentId = found.id;
      }
      if (!resolvedStudentId) return res.status(400).json({ error: "studentId or studentEmail is required" });

      // Check if this specific student is already enrolled
      const allCourseEnrollments = await storage.getEnrollments(courseId);
      const alreadyEnrolled = allCourseEnrollments.find((e: any) => e.studentId === resolvedStudentId);
      if (alreadyEnrolled) return res.status(200).json({ message: "Already enrolled", enrollment: alreadyEnrolled });

      const enrollment = await storage.createEnrollment({ courseId, studentId: resolvedStudentId });
      res.status(201).json(enrollment);
    } catch (error) {
      console.error("Enroll error:", error);
      res.status(500).json({ error: "Failed to enroll student" });
    }
  });

  // Get all enrollments for a course (instructor)
  app.get("/api/courses/:id/enrollments", requireInstructor, async (req, res) => {
    try {
      const enrollments = await storage.getEnrollments(req.params.id as string);
      res.json(enrollments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch enrollments" });
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

      const aiUser = await getAiUser(req.session.userId);
      const aiResult = await generateWithProvider({
        maxTokens: 512,   // summary + key points fit comfortably in 512 tokens
        messages: [{
          role: "user",
          content: `Analyze this lecture and provide:
1. A concise summary (2-3 paragraphs)
2. 5-7 key points as bullet points

Lecture title: ${lecture.title}
Content: ${lecture.description || "No content available"}

Respond in JSON format:
{
  "summary": "string",
  "keyPoints": ["string", "string", ...]
}`
        }],
      }, aiUser);

      const text = aiResult.text;
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

  // GET single quiz by id
  app.get("/api/quizzes/:id", requireAuth, async (req, res) => {
    try {
      const quiz = await storage.getQuiz(req.params.id);
      if (!quiz) return res.status(404).json({ error: "Quiz not found" });
      res.json(quiz);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quiz" });
    }
  });

  // PUT update quiz by id
  app.put("/api/quizzes/:id", requireInstructor, async (req, res) => {
    try {
      const quiz = await storage.getQuiz(req.params.id);
      if (!quiz) return res.status(404).json({ error: "Quiz not found" });
      const updated = await storage.updateQuiz(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update quiz" });
    }
  });

  // POST /api/questions — create a standalone question (optionally link to a quiz)
  app.post("/api/questions", requireInstructor, async (req, res) => {
    try {
      const { quizId, orderIndex, ...questionData } = req.body;
      const question = await storage.createQuestion(questionData);
      // If a quizId is provided, link the question to the quiz
      if (quizId) {
        const quiz = await storage.getQuiz(quizId);
        if (quiz) {
          const existing = await storage.getQuizQuestions(quizId);
          await storage.addQuizQuestion({
            quizId,
            questionId: question.id,
            orderIndex: orderIndex ?? existing.length,
          });
        }
      }
      res.status(201).json(question);
    } catch (error) {
      console.error("Create question error:", error);
      res.status(400).json({ error: "Failed to create question" });
    }
  });

  // POST /api/quizzes/:id/questions — link an existing question to a quiz
  app.post("/api/quizzes/:id/questions", requireInstructor, async (req, res) => {
    try {
      const quiz = await storage.getQuiz(req.params.id);
      if (!quiz) return res.status(404).json({ error: "Quiz not found" });
      const { questionId, orderIndex } = req.body;
      if (!questionId) return res.status(400).json({ error: "questionId required" });
      const existing = await storage.getQuizQuestions(req.params.id);
      await storage.addQuizQuestion({
        quizId: req.params.id,
        questionId,
        orderIndex: orderIndex ?? existing.length,
      });
      res.status(201).json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to link question to quiz" });
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
      // Explicitly require maxScore (DB has a default but we want it to be intentionally set)
      if (req.body.maxScore === undefined || req.body.maxScore === null) {
        return res.status(400).json({ error: "maxScore is required" });
      }
      // Default status to "draft" if not provided (schema requires it but DB has a default)
      // Coerce dueDate string to Date object (drizzle-zod expects Date for timestamp columns)
      const rawBody = { status: "draft", ...req.body };
      if (rawBody.dueDate && typeof rawBody.dueDate === "string") {
        rawBody.dueDate = new Date(rawBody.dueDate);
      }
      const data = insertAssignmentSchema.parse(rawBody);
      const assignment = await storage.createAssignment(data);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Create assignment error:", error);
      res.status(400).json({ error: "Failed to create assignment" });
    }
  });

  // PUT /api/assignments/:id — update assignment (title, status, dueDate, etc.)
  app.put("/api/assignments/:id", requireInstructor, async (req, res) => {
    try {
      const assignment = await storage.getAssignment(req.params.id as string);
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      const updateData: any = { ...req.body };
      if (updateData.dueDate && typeof updateData.dueDate === "string") {
        updateData.dueDate = new Date(updateData.dueDate);
      }
      const updated = await storage.updateAssignment(req.params.id as string, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Update assignment error:", error);
      res.status(500).json({ error: "Failed to update assignment" });
    }
  });

  // DELETE /api/assignments/:id
  app.delete("/api/assignments/:id", requireInstructor, async (req, res) => {
    try {
      const assignment = await storage.getAssignment(req.params.id as string);
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      await storage.deleteAssignment(req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete assignment" });
    }
  });

  // AI Question Generation
  app.post("/api/ai/generate-questions", requireInstructor, async (req, res) => {
    try {
      // Accept 'topic' as an alias for 'content' (topic-based generation)
      const { courseId, difficulty = "mixed" } = req.body;
      const content: string = req.body.content || req.body.topic || "";
      const rawNum = req.body.numQuestions;
      const numQuestions: number = parseInt(String(rawNum ?? 5), 10);

      // Validate numQuestions
      if (isNaN(numQuestions) || numQuestions < 1) {
        return res.status(400).json({ error: "numQuestions must be at least 1" });
      }
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "content or topic is required" });
      }

      const aiUser = await getAiUser(req.session.userId);
      const aiResult = await generateWithProvider({
        maxTokens: 1024,  // each question ~80–120 tokens; 5 questions needs ~600, 10 needs ~1000
        messages: [{
          role: "user",
          content: `Generate ${numQuestions} quiz questions based on the following content.
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
        }],
      }, aiUser);

      const text = aiResult.text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        res.json(parsed);
      } else {
        res.status(422).json({ error: "Failed to parse AI response", raw: text.substring(0, 200) });
      }
    } catch (error: any) {
      console.error("Generate questions error:", error);
      // Surface provider-level errors (e.g. 402 insufficient credits) with a non-500 code
      const msg: string = error?.message || "";
      if (msg.includes("402") || msg.toLowerCase().includes("credit")) {
        return res.status(402).json({ error: "AI provider error: insufficient credits. Please top up your OpenRouter balance.", details: msg.substring(0, 200) });
      }
      if (msg.includes("401") || msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("invalid key")) {
        return res.status(401).json({ error: "AI provider error: invalid or missing API key.", details: msg.substring(0, 200) });
      }
      res.status(500).json({ error: "Failed to generate questions" });
    }
  });

  app.post("/api/ai/generate-questions-from-file", requireInstructor, async (req, res) => {
    try {
      const { fileUrl, fileName, fileType, numQuestions = 5, difficulty = "mixed", courseId } = req.body;

      if (!fileUrl) {
        return res.status(400).json({ error: "File URL is required" });
      }

      const aiUser = await getAiUser(req.session.userId);
      const isImage = fileType?.startsWith("image/");

      // Fetch the file and encode as base64 data URI for multi-modal providers
      const fetchUrl = fileUrl.startsWith("/") ? `${req.protocol}://${req.get("host")}${fileUrl}` : fileUrl;
      const fileResponse = await fetch(fetchUrl);
      const buffer = await fileResponse.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const mimeType = fileType || (isImage ? "image/jpeg" : "application/pdf");
      const dataUri = `data:${mimeType};base64,${base64}`;

      const promptText = isImage
        ? `Analyze this image and generate ${numQuestions} quiz questions based on its content.
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
}`
        : `Analyze this document (${fileName || "uploaded file"}) and generate ${numQuestions} quiz questions based on its content.
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
}`;

      const aiResult = await generateWithProvider({
        maxTokens: 1024,  // file-based question generation; same budget as text generation
        messages: [{
          role: "user",
          content: isImage
            ? [
                { type: "image_url", image_url: { url: dataUri } },
                { type: "text", text: promptText },
              ]
            : promptText,
        }],
      }, aiUser);

      const text = aiResult.text;
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

      const aiUser = await getAiUser(req.session.userId);
      // Build data URI from raw base64 or data URI
      const imageDataUri = imageData.startsWith("data:") ? imageData : `data:image/jpeg;base64,${imageData}`;
      const aiResult = await generateWithProvider({
        maxTokens: 256,   // proctoring response is a tiny JSON array; 256 tokens is plenty
        messages: [{
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageDataUri },
            },
            {
              type: "text",
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
]`,
            },
          ],
        }],
      }, aiUser);

      const text = aiResult.text || "[]";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const violations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

      // Upload screenshot to GCS only when violations are detected (save storage cost)
      let screenshotPath: string | null = null;
      if (violations.length > 0 && imageData) {
        try {
          const objService = new ObjectStorageService();
          const privateDir = process.env.PRIVATE_OBJECT_DIR;
          if (privateDir) {
            const { randomUUID } = await import("crypto");
            const screenshotId = randomUUID();
            const fullPath = `${privateDir}/screenshots/${screenshotId}.jpg`;
            // fullPath format: /<bucket>/<object>
            const parts = fullPath.replace(/^\//, "").split("/");
            const bucketName = parts[0];
            const objectName = parts.slice(1).join("/");
            const { objectStorageClient } = await import("./replit_integrations/object_storage");
            const bucket = objectStorageClient.bucket(bucketName);
            const file = bucket.file(objectName);
            const base64Data = imageData.split(",")[1] || imageData;
            const buffer = Buffer.from(base64Data, "base64");
            await file.save(buffer, { contentType: "image/jpeg" });
            screenshotPath = `/objects/screenshots/${screenshotId}.jpg`;
          }
        } catch (uploadError) {
          console.warn("Screenshot upload to GCS failed (non-critical):", uploadError);
        }
      }

      res.json({ violations, screenshotPath });
    } catch (error) {
      console.error("Analyze frame error:", error);
      res.json({ violations: [] });
    }
  });

  // Analytics
  app.get("/api/analytics", requireInstructor, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ error: "Not found" });
      const courseId = req.query.courseId as string | undefined;
      const analytics = await storage.getCourseAnalytics(
        courseId === "all" ? undefined : courseId,
        user.id
      );
      res.json(analytics);
    } catch (error) {
      console.error("Analytics error:", error);
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

      // Short-circuit empty commands immediately (no AI call needed)
      if (!command || typeof command !== "string" || command.trim().length === 0) {
        return res.status(400).json({ error: "Command cannot be empty" });
      }

      const chatCommand = await storage.createChatCommand({
        userId,
        command,
        status: "executing",
      });

      const user = await storage.getUser(userId);
      const isAdmin = user?.role === "admin";

      // ── Gather live platform context to inject into the prompt ──────────────
      const [allCourses, allStudents] = await Promise.all([
        storage.getCourses(isAdmin ? undefined : userId),
        storage.getUsers("student"),
      ]);

      // Fetch quizzes for all courses
      const quizzesByCourse = await Promise.all(allCourses.map(c => storage.getQuizzes(c.id)));
      const allQuizzes = quizzesByCourse.flat();
      const assignmentsByCourse = await Promise.all(allCourses.map(c => storage.getAssignments(c.id)));
      const allAssignments = assignmentsByCourse.flat();
      const lecturesByCourse = await Promise.all(allCourses.map(c => storage.getLectures(c.id)));
      const allLectures = lecturesByCourse.flat();

      // Fetch public quiz submission counts for context
      const publicSubCounts: Record<string, number> = {};
      for (const q of allQuizzes) {
        if (q.publicAccessToken) {
          const subs = await storage.getPublicQuizSubmissions(q.id);
          if (subs.length > 0) publicSubCounts[q.id] = subs.length;
        }
      }

      // Fetch recent chat history for conversation memory
      const recentHistory = await storage.getChatCommands(userId);
      const lastFewCommands = recentHistory
        .filter(c => c.status === "completed" && c.id !== chatCommand.id)
        .slice(-4)
        .map(c => `User: "${c.command}" → Result: ${JSON.stringify(c.result?.message || "done").substring(0, 120)}`);
      const conversationContext = lastFewCommands.length > 0
        ? `\n=== RECENT CONVERSATION (for context/follow-up) ===\n${lastFewCommands.join("\n")}\n=== END RECENT ===\n`
        : "";

      // Trim context to at most 8 items each to keep INPUT tokens small (free-tier credit limits)
      const ctxCourses = allCourses.slice(0, 8);
      const ctxQuizzes = allQuizzes.slice(0, 8);
      const ctxAssignments = allAssignments.slice(0, 8);
      const ctxLectures = allLectures.slice(0, 8);
      const ctxStudents = allStudents.slice(0, 8);
      const moreNote = (arr: any[], cap: number) => arr.length > cap ? ` (+${arr.length - cap} more)` : "";

      const contextBlock = `
=== PLATFORM CONTEXT (live data) ===${conversationContext}
Courses (${allCourses.length}): ${ctxCourses.map(c => `"${c.name}" [code:${c.code}, id:${c.id}]`).join(", ") || "none"}${moreNote(allCourses, 8)}
Quizzes (${allQuizzes.length}): ${ctxQuizzes.map(q => `"${q.title}" [course:${allCourses.find(c=>c.id===q.courseId)?.name||"?"}, status:${q.status}, id:${q.id}]`).join(", ") || "none"}${moreNote(allQuizzes, 8)}
Assignments (${allAssignments.length}): ${ctxAssignments.map(a => `"${a.title}" [course:${allCourses.find(c=>c.id===a.courseId)?.name||"?"}, status:${a.status}, id:${a.id}]`).join(", ") || "none"}${moreNote(allAssignments, 8)}
Lectures (${allLectures.length}): ${ctxLectures.map(l => `"${l.title}" [course:${allCourses.find(c=>c.id===l.courseId)?.name||"?"}, id:${l.id}]`).join(", ") || "none"}${moreNote(allLectures, 8)}
Students (${allStudents.length}): ${ctxStudents.map(s => `"${s.name}" [email:${s.email}, id:${s.id}]`).join(", ") || "none"}${moreNote(allStudents, 8)}
Current user: ${user?.name} (${user?.role})
=== END CONTEXT ===

=== PLATFORM KNOWLEDGE (all features & routes) ===
QUIZ LIFECYCLE:
  - Draft → Published → Archived
  - Students access published quizzes via /quiz/:id/take
  - Proctored quizzes use webcam AI monitoring (face detection, phone detection, fullscreen enforcement)
  - After submission: results shown at /quiz/:id/results/:submissionId with score, per-question breakdown, AI feedback
  - Public links: /public/quiz/:token — students can take without login
  - Violation threshold: default 5 violations auto-submits the quiz

ASSIGNMENT LIFECYCLE:
  - Draft → Published
  - Students submit at /assignment/:id/submit (text + file upload)
  - Instructor grades at /assignment-submissions/:id/grade
  - AI grading uses rubric criteria with scores and feedback
  - AI content detection returns % probability of AI-written text
  - Bulk AI grading: grades all ungraded submissions at once

QUIZ QUESTION TYPES: mcq (multiple choice), true_false, short_answer, fill_blank
QUIZ SETTINGS: timeLimitMinutes, passingScore (%), proctored (bool), violationThreshold, status
ASSIGNMENT SETTINGS: maxScore, dueDate, allowLateSubmission, latePenaltyPercent, rubric (array of criterion/maxPoints/description)

ANALYTICS:
  - Dashboard: /analytics — score distribution, performance trends, top/low performers, violation stats
  - Gradebook: /gradebook?courseId= — full matrix of students × assessments, CSV export
  - Student profiles: /students/:id — individual score trends, quiz/assignment history

STUDENT MANAGEMENT:
  - Students self-register at /register
  - Instructors enroll students via chatbot or /courses/:id/enroll API
  - Students see their courses, quizzes, assignments after enrollment
  - Pattern lock login available (alternative to password)

AI FEATURES (available now):
  - Quiz question generation from text or uploaded files (PDF, images)
  - Assignment AI grading with rubric
  - AI content detection (human vs AI-written)
  - Lecture summarization with key points
  - Chatbot co-pilot (this!) with full platform control
  - Proctoring frame analysis (webcam screenshots → violation detection)

ACTIVE AI PROVIDER: ${user?.activeAiProvider || "gemini"}
=== END KNOWLEDGE ===`;

      const intentPrompt = `You are an expert AI co-pilot for EduAssess AI — an educational assessment platform. You are deeply familiar with the platform and can perform ANY management task the instructor asks, in natural language.

${contextBlock}

Analyze the user command below and extract ALL intended actions as an ordered array of tasks.

AVAILABLE INTENTS (use EXACTLY these strings):
  Content Creation:
    "create_course" — params: name, code, semester, description
    "create_quiz" — params: title, topic, courseName, numQuestions (default 5), difficulty (easy/medium/hard/mixed), generateQuestions (bool), timeLimitMinutes, passingScore
    "create_assignment" — params: title, courseName, description, instructions, dueDate (ISO string), points, rubric (array of {criterion,maxPoints,description})
    "create_lecture" — params: title, courseName, unit, description, videoUrl

  Content Updates:
    "update_quiz" — params: quizName (or quizId), title, description, timeLimitMinutes, passingScore, status, proctored (bool)
    "update_course" — params: courseName (or courseId), name, description, semester
    "update_assignment" — params: assignmentName (or assignmentId), title, description, dueDate, points, allowLateSubmission (bool), latePenaltyPercent
    "update_lecture" — params: lectureName (or lectureId), title, description, unit, videoUrl

  Publishing & Status:
    "publish_quiz" — params: quizName (or "all" to publish all drafts)
    "unpublish_quiz" — params: quizName
    "publish_assignment" — params: assignmentName
    "archive_quiz" — params: quizName

  Deletion:
    "delete_quiz" — params: quizName
    "delete_course" — params: courseName
    "delete_assignment" — params: assignmentName
    "delete_lecture" — params: lectureName

  Listing & Querying:
    "list_quizzes" — params: courseName (optional), status (optional: draft/published/archived)
    "list_courses" — no params
    "list_assignments" — params: courseName (optional)
    "list_lectures" — params: courseName (optional)
    "list_enrollments" — params: courseName
    "list_submissions" — params: quizName or assignmentName, type (quiz or assignment). Use this when user asks "show results", "who attempted", "see submissions", "view results of quiz"
    "list_students" — no params

  Sharing & Links:
    "generate_public_link" — params: quizName, permission (view or attempt)

  Student Management:
    "enroll_student" — params: courseName, studentName or studentEmail
    "unenroll_student" — params: courseName, studentName or studentEmail
    "show_student_performance" — params: studentName or studentEmail

  Grading & Analytics:
    "grade_submission" — params: assignmentName (or "all")
    "ai_grade_all" — params: assignmentName
    "view_analytics" — no params
    "view_gradebook" — params: courseName (optional)

  AI Features:
    "generate_questions" — params: topic, courseName, numQuestions (default 5), difficulty
    "summarize_lecture" — params: lectureName

  Navigation:
    "navigate" — params: page (dashboard/courses/quizzes/assignments/lectures/analytics/gradebook/settings/quiz-builder)

  Conversational:
    "question" — params: question (the user's free-form question). Use when user asks something that needs an AI answer rather than an action (e.g. "how many students passed?", "what is my best course?", "explain quiz proctoring")
    "help" — no params

RULES:
- Detect ALL tasks in a single message (user may chain with "and", "then", "also")
- Order tasks logically (create course → create quiz → publish → generate link)
- For "create_quiz" with a topic: always set generateQuestions=true AND include topic in params
- For "generate_questions": always include topic in params.topic (extract from the user's message — e.g. "generate questions on photosynthesis" → topic:"photosynthesis")
- For "update_quiz": identify the quiz by name from context; set only the params that the user mentioned
- For "question" intent: include the full question in params.question so we can answer it with platform data
- If user says "publish all quizzes", use publish_quiz with quizName="all"
- Match course/quiz names fuzzily against PLATFORM CONTEXT — use the exact name from context
- Be generous: "make a test on photosynthesis" → create_quiz with generateQuestions=true, topic:"photosynthesis"
- "set time limit to 30 minutes on the midterm quiz" → update_quiz
- CONTEXT FOLLOW-UP: If user says "it", "that", "this quiz", "the result", "cant access it" — use RECENT CONVERSATION context to figure out what they refer to
- "show results", "see who attempted", "view quiz results" → list_submissions
- If user just says "show results of that quiz" and recent context has a quiz — use list_submissions with the quiz from context

Return ONLY this JSON (no markdown):
{
  "tasks": [
    { "intent": "<one of above>", "parameters": { ... } }
  ],
  "message": "brief human-readable summary of what you will do"
}

User command: "${command}"`;

      const aiUser = await getAiUser(userId);

      // Call the intent classifier; handle AI provider failures gracefully
      let intentResult;
      let providerError: string | null = null;
      try {
        intentResult = await generateWithProvider({
          messages: [{ role: "user", content: intentPrompt }],
          maxTokens: 512,   // intent JSON is compact; keep within free-tier limits
        }, aiUser);
      } catch (primaryErr: any) {
        const msg = String(primaryErr?.message || primaryErr || "");
        const isCreditsError = msg.includes("402") || msg.toLowerCase().includes("credit") || msg.toLowerCase().includes("insufficient");
        if (isCreditsError) {
          console.warn("Co-pilot: primary provider credit error, trying platform Gemini fallback");
          try {
            intentResult = await generateWithProvider({
              messages: [{ role: "user", content: intentPrompt }],
              maxTokens: 512,
            }, undefined);  // undefined → platform Gemini key via env
          } catch (fallbackErr: any) {
            // Both providers failed — store the reason and return 402
            providerError = "AI provider has insufficient credits. Please top up your OpenRouter balance or configure a different AI provider in Settings → AI Provider.";
            console.warn("Co-pilot: fallback also failed:", fallbackErr?.message);
          }
        } else {
          throw primaryErr;
        }
      }

      // If all providers failed, respond with 402 (graceful, not a crash)
      if (providerError) {
        await storage.updateChatCommand(chatCommand.id, {
          status: "failed",
          result: { success: false, message: providerError },
          completedAt: new Date(),
        });
        return res.status(402).json({ error: providerError, provider: "insufficient_credits" });
      }

      const responseText = intentResult.text;

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
        parsed = { tasks: [{ intent: "question", parameters: { question: command } }], message: "Let me answer that for you." };
      }

      // Use pre-fetched context data (allCourses, allQuizzes, allAssignments, allLectures, allStudents)
      const findCourse = (name?: string) => {
        if (!name) return allCourses[0];
        return allCourses.find(c =>
          c.name.toLowerCase().includes(name.toLowerCase()) ||
          c.code.toLowerCase().includes(name.toLowerCase()) ||
          c.id === name
        ) || allCourses[0];
      };

      const findMyQuiz = (name?: string) => {
        if (!name) return allQuizzes[allQuizzes.length - 1];
        return allQuizzes.find(q =>
          q.title.toLowerCase().includes(name.toLowerCase()) ||
          q.id === name
        ) || allQuizzes[allQuizzes.length - 1];
      };

      const findMyAssignment = (name?: string) => {
        if (!name) return allAssignments[allAssignments.length - 1];
        return allAssignments.find(a =>
          a.title.toLowerCase().includes(name.toLowerCase()) ||
          a.id === name
        ) || allAssignments[allAssignments.length - 1];
      };

      const findMyLecture = (name?: string) => {
        if (!name) return allLectures[allLectures.length - 1];
        return allLectures.find(l =>
          l.title.toLowerCase().includes(name.toLowerCase()) ||
          l.id === name
        ) || allLectures[allLectures.length - 1];
      };

      const findStudent = (nameOrEmail?: string) => {
        if (!nameOrEmail) return undefined;
        const q = nameOrEmail.toLowerCase();
        return allStudents.find(s =>
          s.email.toLowerCase() === q ||
          s.name.toLowerCase().includes(q) ||
          s.id === nameOrEmail
        );
      };

      // Helper: call generateWithProvider with automatic fallback to platform Gemini on 402/credit errors
      const generateWithFallback = async (opts: Parameters<typeof generateWithProvider>[0]) => {
        try {
          return await generateWithProvider(opts, aiUser);
        } catch (err: any) {
          const msg = String(err?.message || err || "");
          const isCreditsError = msg.includes("402") || msg.toLowerCase().includes("credit") || msg.toLowerCase().includes("insufficient");
          if (isCreditsError) {
            console.warn("Co-pilot task: credit error, falling back to platform Gemini");
            try {
              return await generateWithProvider(opts, undefined);
            } catch (fallbackErr: any) {
              // Platform Gemini also unavailable — throw a 402-tagged error so outer catch returns 402
              throw new Error("402: AI provider insufficient_credits — " + String(fallbackErr?.message || fallbackErr));
            }
          }
          throw err;
        }
      };

      // Helper: generate questions for a quiz
      const generateQuestionsForQuiz = async (quizId: string, courseId: string, topic: string, numQuestions: number, difficulty: string) => {
        try {
          const safeNum = Math.max(1, parseInt(String(numQuestions), 10) || 5);
          const genPrompt = `Generate ${safeNum} quiz questions about "${topic}".
Return a JSON object with a "questions" array. Each question should have:
- type: one of "mcq", "true_false", "short_answer", "fill_blank"
- text: the question text
- options: array of options (for mcq, 4 options; for true_false use ["True","False"]; empty array for others)
- correctAnswer: the correct answer string
- difficulty: "${difficulty === "mixed" ? "easy, medium, or hard (vary them)" : difficulty}"
- points: 1 for easy, 2 for medium, 3 for hard

Make questions clear, educational, and varied in type.
Return only valid JSON, no markdown.`;
          const genResult = await generateWithFallback({ messages: [{ role: "user", content: genPrompt }], maxTokens: 1024 });
          const genMatch = genResult.text.match(/\{[\s\S]*\}/);
          if (!genMatch) return 0;
          const genParsed = JSON.parse(genMatch[0]);
          if (!genParsed.questions || !Array.isArray(genParsed.questions)) return 0;
          for (let qi = 0; qi < genParsed.questions.length; qi++) {
            const q = genParsed.questions[qi];
            const question = await storage.createQuestion({
              courseId, type: q.type || "mcq", text: q.text,
              options: q.options || [], correctAnswer: q.correctAnswer || "",
              points: q.points || 1, difficulty: q.difficulty || "medium", aiGenerated: true,
            });
            await storage.addQuizQuestion({ quizId, questionId: question.id, orderIndex: qi });
          }
          return genParsed.questions.length;
        } catch (err) {
          console.error("generateQuestionsForQuiz error:", err);
          return 0;
        }
      };

      const executeTask = async (intent: string, params: any): Promise<{ success: boolean; message: string; data?: any }> => {

        // ── CREATE ──────────────────────────────────────────────────────────────
        if (intent === "create_course") {
          const course = await storage.createCourse({
            name: params.name || params.title || "New Course",
            code: params.code || `COURSE${Math.floor(100 + Math.random() * 900)}`,
            semester: params.semester || "Spring 2026",
            description: params.description || "",
            instructorId: userId,
          });
          // Update allCourses in-memory so subsequent tasks can find it
          allCourses.push(course);
          return { success: true, message: `✅ Created course **"${course.name}"** (${course.code})`, data: { course } };

        } else if (intent === "create_quiz") {
          const course = findCourse(params.courseName || params.course);
          if (!course) return { success: false, message: "❌ No courses found. Create a course first." };
          const quizTitle = params.title || params.name || params.topic || "New Quiz";
          const quiz = await storage.createQuiz({
            courseId: course.id,
            title: quizTitle,
            description: params.description || `Quiz on ${params.topic || quizTitle}`,
            status: "draft",
            timeLimitMinutes: params.timeLimitMinutes ? parseInt(params.timeLimitMinutes) : null,
            passingScore: params.passingScore ? parseInt(params.passingScore) : null,
          });
          allQuizzes.push(quiz);

          const genTopic = params.topic || (params.generateQuestions ? quizTitle : null);
          if (genTopic) {
            try {
              const count = await generateQuestionsForQuiz(
                quiz.id, course.id,
                genTopic,
                parseInt(params.numQuestions) || 5,
                params.difficulty || "mixed"
              );
              if (count > 0) {
                return { success: true, message: `✅ Created quiz **"${quiz.title}"** in **${course.name}** with **${count} AI-generated questions**`, data: { quiz, questionsGenerated: count, navigateTo: "/quizzes" } };
              }
            } catch (genErr) { console.error("AI question gen failed:", genErr); }
          }
          return { success: true, message: `✅ Created quiz **"${quiz.title}"** in **${course.name}**. Add questions in the Quiz Builder.`, data: { quiz, navigateTo: "/quizzes" } };

        } else if (intent === "create_assignment") {
          const course = findCourse(params.courseName);
          if (!course) return { success: false, message: "❌ No courses found. Create a course first." };
          const due = params.dueDate ? new Date(params.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const assignment = await storage.createAssignment({
            courseId: course.id,
            title: params.title || params.name || "New Assignment",
            description: params.description || "Created via Co-pilot",
            instructions: params.instructions || null,
            dueDate: due,
            maxScore: params.points ? parseInt(params.points) : 100,
            status: "draft",
            rubric: params.rubric || null,
          });
          allAssignments.push(assignment);
          return { success: true, message: `✅ Created assignment **"${assignment.title}"** in **${course.name}** (due ${due.toLocaleDateString()})`, data: { assignment } };

        } else if (intent === "create_lecture") {
          const course = findCourse(params.courseName);
          if (!course) return { success: false, message: "❌ No courses found. Create a course first." };
          const lecture = await storage.createLecture({
            courseId: course.id,
            title: params.title || params.name || "New Lecture",
            description: params.description || "",
            unit: params.unit || "Unit 1",
            videoUrl: params.videoUrl || null,
          });
          allLectures.push(lecture);
          return { success: true, message: `✅ Created lecture **"${lecture.title}"** in **${course.name}** (${lecture.unit})`, data: { lecture } };

        // ── UPDATE ──────────────────────────────────────────────────────────────
        } else if (intent === "update_quiz") {
          const quiz = findMyQuiz(params.quizName || params.title || params.quizId);
          if (!quiz) return { success: false, message: "❌ Could not find that quiz." };
          const updateData: any = {};
          if (params.title) updateData.title = params.title;
          if (params.description) updateData.description = params.description;
          if (params.timeLimitMinutes !== undefined) updateData.timeLimitMinutes = parseInt(params.timeLimitMinutes);
          if (params.passingScore !== undefined) updateData.passingScore = parseInt(params.passingScore);
          if (params.status) updateData.status = params.status;
          if (params.proctored !== undefined) updateData.proctored = params.proctored;
          const updated = await storage.updateQuiz(quiz.id, updateData);
          const changes = Object.entries(updateData).map(([k, v]) => `${k}: ${v}`).join(", ");
          return { success: true, message: `✅ Updated quiz **"${quiz.title}"** — ${changes}`, data: { quiz: updated } };

        } else if (intent === "update_course") {
          const course = findCourse(params.courseName || params.courseId);
          if (!course) return { success: false, message: "❌ Could not find that course." };
          const updateData: any = {};
          if (params.name) updateData.name = params.name;
          if (params.description) updateData.description = params.description;
          if (params.semester) updateData.semester = params.semester;
          const updated = await storage.updateCourse(course.id, updateData);
          return { success: true, message: `✅ Updated course **"${course.name}"**`, data: { course: updated } };

        } else if (intent === "update_assignment") {
          const assignment = findMyAssignment(params.assignmentName || params.assignmentId);
          if (!assignment) return { success: false, message: "❌ Could not find that assignment." };
          const updateData: any = {};
          if (params.title) updateData.title = params.title;
          if (params.description) updateData.description = params.description;
          if (params.dueDate) updateData.dueDate = new Date(params.dueDate);
          if (params.points) updateData.maxScore = parseInt(params.points);
          if (params.allowLateSubmission !== undefined) updateData.allowLateSubmission = params.allowLateSubmission;
          if (params.latePenaltyPercent !== undefined) updateData.latePenaltyPercent = parseInt(params.latePenaltyPercent);
          const updated = await storage.updateAssignment(assignment.id, updateData);
          return { success: true, message: `✅ Updated assignment **"${assignment.title}"**`, data: { assignment: updated } };

        } else if (intent === "update_lecture") {
          const lecture = findMyLecture(params.lectureName || params.lectureId);
          if (!lecture) return { success: false, message: "❌ Could not find that lecture." };
          const updateData: any = {};
          if (params.title) updateData.title = params.title;
          if (params.description) updateData.description = params.description;
          if (params.unit) updateData.unit = params.unit;
          if (params.videoUrl) updateData.videoUrl = params.videoUrl;
          const updated = await storage.updateLecture(lecture.id, updateData);
          return { success: true, message: `✅ Updated lecture **"${lecture.title}"**`, data: { lecture: updated } };

        // ── PUBLISH / STATUS ────────────────────────────────────────────────────
        } else if (intent === "publish_quiz") {
          const nameOrAll = params.title || params.name || params.quizName || "";
          if (nameOrAll.toLowerCase() === "all") {
            const drafts = allQuizzes.filter(q => q.status === "draft");
            for (const q of drafts) await storage.updateQuiz(q.id, { status: "published" });
            return { success: true, message: `✅ Published **${drafts.length} quizzes**`, data: { published: drafts.length } };
          }
          const quiz = findMyQuiz(nameOrAll);
          if (!quiz) return { success: false, message: "❌ No quiz found to publish." };
          const updated = await storage.updateQuiz(quiz.id, { status: "published" });
          return { success: true, message: `✅ Published quiz **"${quiz.title}"** — students can now take it`, data: { quiz: updated } };

        } else if (intent === "unpublish_quiz") {
          const quiz = findMyQuiz(params.title || params.name || params.quizName);
          if (!quiz) return { success: false, message: "❌ No quiz found." };
          const updated = await storage.updateQuiz(quiz.id, { status: "draft" });
          return { success: true, message: `✅ Unpublished quiz **"${quiz.title}"** — moved back to draft`, data: { quiz: updated } };

        } else if (intent === "archive_quiz") {
          const quiz = findMyQuiz(params.title || params.name || params.quizName);
          if (!quiz) return { success: false, message: "❌ No quiz found." };
          const updated = await storage.updateQuiz(quiz.id, { status: "archived" });
          return { success: true, message: `✅ Archived quiz **"${quiz.title}"**`, data: { quiz: updated } };

        } else if (intent === "publish_assignment") {
          const assignment = findMyAssignment(params.title || params.name || params.assignmentName);
          if (!assignment) return { success: false, message: "❌ No assignment found." };
          const updated = await storage.updateAssignment(assignment.id, { status: "published" });
          return { success: true, message: `✅ Published assignment **"${assignment.title}"**`, data: { assignment: updated } };

        // ── DELETE ──────────────────────────────────────────────────────────────
        } else if (intent === "delete_quiz") {
          const quiz = findMyQuiz(params.title || params.name || params.quizName);
          if (!quiz) return { success: false, message: "❌ No matching quiz found." };
          await storage.deleteQuiz(quiz.id);
          return { success: true, message: `🗑️ Deleted quiz **"${quiz.title}"**`, data: { deleted: true } };

        } else if (intent === "delete_course") {
          const course = findCourse(params.name || params.title || params.courseName);
          if (!course) return { success: false, message: "❌ No matching course found." };
          await storage.deleteCourse(course.id);
          return { success: true, message: `🗑️ Deleted course **"${course.name}"**`, data: { deleted: true } };

        } else if (intent === "delete_assignment") {
          const match = findMyAssignment(params.title || params.name || params.assignmentName);
          if (!match) return { success: false, message: "❌ No assignments found to delete." };
          await storage.deleteAssignment(match.id);
          return { success: true, message: `🗑️ Deleted assignment **"${match.title}"**`, data: { deleted: true } };

        } else if (intent === "delete_lecture") {
          const match = findMyLecture(params.title || params.name || params.lectureName);
          if (!match) return { success: false, message: "❌ No lectures found to delete." };
          await storage.deleteLecture(match.id);
          return { success: true, message: `🗑️ Deleted lecture **"${match.title}"**`, data: { deleted: true } };

        // ── SHARING ─────────────────────────────────────────────────────────────
        } else if (intent === "generate_public_link") {
          const quiz = findMyQuiz(params.quizName || params.title || params.name);
          if (!quiz) return { success: false, message: "❌ No quiz found to generate a link for." };
          const permission = params.permission === "view" ? "view" : "attempt";
          const updated = await storage.generateQuizPublicLink(quiz.id, permission, ["name", "email"]);
          if (!updated) return { success: false, message: "❌ Failed to generate public link." };
          const publicUrl = `http://localhost:5000/public/quiz/${updated.publicAccessToken}`;
          return { success: true, message: `🔗 Generated **${permission}** public link for **"${quiz.title}"**\n\n\`${publicUrl}\`\n\nStudents can access without logging in.`, data: { quiz: updated, publicUrl } };

        // ── LISTING ─────────────────────────────────────────────────────────────
        } else if (intent === "list_quizzes") {
          const filtered = params.courseName
            ? allQuizzes.filter(q => { const c = allCourses.find(c2 => c2.id === q.courseId); return c?.name.toLowerCase().includes(params.courseName.toLowerCase()); })
            : params.status ? allQuizzes.filter(q => q.status === params.status) : allQuizzes;
          return { success: true, message: `📋 Found **${filtered.length} quiz${filtered.length !== 1 ? "zes" : ""}**${params.courseName ? ` in "${params.courseName}"` : ""}`, data: { quizzes: filtered.slice(0, 15) } };

        } else if (intent === "list_courses") {
          return { success: true, message: `📋 Found **${allCourses.length} course${allCourses.length !== 1 ? "s" : ""}**`, data: { courses: allCourses } };

        } else if (intent === "list_assignments") {
          const filtered = params.courseName
            ? allAssignments.filter(a => { const c = allCourses.find(c2 => c2.id === a.courseId); return c?.name.toLowerCase().includes(params.courseName.toLowerCase()); })
            : allAssignments;
          return { success: true, message: `📋 Found **${filtered.length} assignment${filtered.length !== 1 ? "s" : ""}**`, data: { assignments: filtered.slice(0, 15) } };

        } else if (intent === "list_lectures") {
          const filtered = params.courseName
            ? allLectures.filter(l => { const c = allCourses.find(c2 => c2.id === l.courseId); return c?.name.toLowerCase().includes(params.courseName.toLowerCase()); })
            : allLectures;
          return { success: true, message: `📋 Found **${filtered.length} lecture${filtered.length !== 1 ? "s" : ""}**`, data: { lectures: filtered.slice(0, 15) } };

        } else if (intent === "list_students") {
          return { success: true, message: `👥 Found **${allStudents.length} student${allStudents.length !== 1 ? "s" : ""}** registered`, data: { students: allStudents.map(s => ({ id: s.id, name: s.name, email: s.email })) } };

        } else if (intent === "list_enrollments") {
          const course = findCourse(params.courseName);
          if (!course) return { success: false, message: "❌ No courses found." };
          const enrollments = await storage.getEnrollments(course.id);
          const enriched = await Promise.all(enrollments.map(async e => {
            const s = await storage.getUser(e.studentId);
            return { ...e, studentName: s?.name || "Unknown", studentEmail: s?.email || "" };
          }));
          return { success: true, message: `👥 **${enriched.length} student${enriched.length !== 1 ? "s" : ""}** enrolled in **"${course.name}"**`, data: { enrollments: enriched } };

        } else if (intent === "list_submissions") {
          const isAssignment = params.type === "assignment";
          if (isAssignment) {
            const assignment = findMyAssignment(params.assignmentName || params.title);
            if (!assignment) return { success: false, message: "❌ No assignment found." };
            const subs = await storage.getAssignmentSubmissions(assignment.id);
            return { success: true, message: `📝 **${subs.length} submission${subs.length !== 1 ? "s" : ""}** for **"${assignment.title}"**`, data: { submissions: subs.slice(0, 15), navigateTo: `/assignments/${assignment.id}/submissions` } };
          }
          const quiz = findMyQuiz(params.quizName || params.title);
          if (!quiz) return { success: false, message: "❌ No quiz found." };
          const subs = await storage.getQuizSubmissions(quiz.id);
          const publicSubs = quiz.publicAccessToken ? await storage.getPublicQuizSubmissions(quiz.id) : [];
          const enriched = await Promise.all(subs.slice(0, 15).map(async s => {
            const stu = await storage.getUser(s.studentId);
            return { ...s, studentName: stu?.name || "Unknown", submissionType: "enrolled" };
          }));
          const enrichedPublic = publicSubs.slice(0, 15).map(s => ({
            ...s,
            studentName: (s.identificationData as any)?.name || (s.identificationData as any)?.email || "Anonymous (public link)",
            submissionType: "public",
            score: s.score,
            completedAt: s.submittedAt,
          }));
          const allSubs = [...enriched, ...enrichedPublic];
          const totalCount = subs.length + publicSubs.length;
          const resultUrl = publicSubs.length > 0 && publicSubs[0].id
            ? `/quiz/${quiz.id}/results/${publicSubs[0].id}`
            : `/quiz/${quiz.id}/submissions`;
          return {
            success: true,
            message: `📝 **${totalCount} submission${totalCount !== 1 ? "s" : ""}** for **"${quiz.title}"**` +
              (publicSubs.length > 0 ? ` (${publicSubs.length} via public link)` : "") +
              (subs.length > 0 ? ` (${subs.length} enrolled students)` : ""),
            data: { submissions: allSubs, navigateTo: resultUrl }
          };

        // ── ANALYTICS ───────────────────────────────────────────────────────────
        } else if (intent === "view_analytics") {
          const stats = await storage.getDashboardStats(userId);
          return { success: true, message: `📊 Platform stats: **${stats.totalCourses}** courses, **${stats.totalQuizzes}** quizzes, **${stats.totalStudents}** students, **${stats.recentSubmissions}** recent submissions, **${stats.pendingGrading}** pending grading`, data: { stats, navigateTo: "/analytics" } };

        } else if (intent === "view_gradebook") {
          const course = findCourse(params.courseName);
          const navigateTo = course ? `/gradebook?courseId=${course.id}` : "/gradebook";
          return { success: true, message: course ? `📊 Opening gradebook for **"${course.name}"**` : "📊 Opening gradebook", data: { navigateTo } };

        // ── STUDENT MANAGEMENT ───────────────────────────────────────────────────
        } else if (intent === "enroll_student") {
          const course = findCourse(params.courseName);
          if (!course) return { success: false, message: `❌ Could not find course "${params.courseName}".` };
          const student = findStudent(params.studentEmail || params.studentName);
          if (!student) return { success: false, message: `❌ Could not find student "${params.studentEmail || params.studentName}". Check the name/email.` };
          const existing = await storage.getEnrollments(course.id, student.id);
          if (existing.length > 0) return { success: false, message: `⚠️ **${student.name}** is already enrolled in **"${course.name}"**.` };
          await storage.createEnrollment({ courseId: course.id, studentId: student.id });
          return { success: true, message: `✅ Enrolled **${student.name}** in **"${course.name}"**`, data: { enrollments: [{ studentName: student.name, courseName: course.name }] } };

        } else if (intent === "unenroll_student") {
          const course = findCourse(params.courseName);
          if (!course) return { success: false, message: `❌ Could not find course "${params.courseName}".` };
          const student = findStudent(params.studentEmail || params.studentName);
          if (!student) return { success: false, message: `❌ Could not find student "${params.studentEmail || params.studentName}".` };
          await storage.deleteEnrollment(course.id, student.id);
          return { success: true, message: `✅ Unenrolled **${student.name}** from **"${course.name}"**`, data: {} };

        } else if (intent === "show_student_performance") {
          const student = findStudent(params.studentEmail || params.studentName);
          if (!student) return { success: false, message: `❌ Could not find student "${params.studentName || params.studentEmail}".` };
          return { success: true, message: `📈 Opening performance dashboard for **${student.name}**`, data: { navigateTo: `/students/${student.id}` } };

        // ── GRADING ─────────────────────────────────────────────────────────────
        } else if (intent === "grade_submission") {
          const assignment = findMyAssignment(params.assignmentName || params.assignment || params.title);
          if (!assignment) return { success: false, message: "❌ Could not find that assignment." };
          const subs = await storage.getAssignmentSubmissions(assignment.id);
          const ungraded = subs.filter(s => s.status === "submitted");
          return { success: true, message: `📝 **${ungraded.length}** ungraded submission(s) for **"${assignment.title}"** — opening submissions page`, data: { navigateTo: `/assignments/${assignment.id}/submissions` } };

        } else if (intent === "ai_grade_all") {
          const assignment = findMyAssignment(params.assignmentName || params.assignment || params.title);
          if (!assignment) return { success: false, message: "❌ Could not find that assignment." };
          // Trigger the bulk AI grading endpoint internally
          return { success: true, message: `🤖 Triggering AI grading for **"${assignment.title}"** — opening submissions page`, data: { navigateTo: `/assignments/${assignment.id}/submissions`, aiGradeAll: true, assignmentId: assignment.id } };

        // ── AI FEATURES ──────────────────────────────────────────────────────────
        } else if (intent === "generate_questions") {
          const course = findCourse(params.courseName);
          if (!course) return { success: false, message: "❌ Please specify a course." };
          // Fall back gracefully when topic is missing
          const topic = params.topic || params.title || params.subject ||
            (allQuizzes.length > 0 ? allQuizzes[allQuizzes.length - 1].title : null) ||
            course.name;
          const quizTitle = `${topic} — Practice Questions`;
          // Create a temporary quiz to hold the questions
          const quiz = await storage.createQuiz({
            courseId: course.id,
            title: quizTitle,
            description: `AI-generated questions on ${topic}`,
            status: "draft",
          });
          const count = await generateQuestionsForQuiz(quiz.id, course.id, topic, parseInt(params.numQuestions) || 5, params.difficulty || "mixed");
          return { success: true, message: `🤖 Generated **${count} questions** on **"${topic}"** (Quiz: "${quizTitle}") — open in Quiz Builder to review them`, data: { quiz, questionsGenerated: count, navigateTo: `/quizzes` } };

        } else if (intent === "summarize_lecture") {
          const lecture = findMyLecture(params.lectureName);
          if (!lecture) return { success: false, message: "❌ Could not find that lecture." };
          const sumResult = await generateWithFallback({
            messages: [{ role: "user", content: `Summarize this lecture in 3 bullet points:\nTitle: ${lecture.title}\nContent: ${lecture.description || "No description"}` }],
            maxTokens: 256,   // 3 bullet points fits in ~150 tokens
          });
          await storage.updateLecture(lecture.id, { summary: sumResult.text });
          return { success: true, message: `📖 **Summary for "${lecture.title}":**\n\n${sumResult.text}`, data: { lecture } };

        // ── NAVIGATION ───────────────────────────────────────────────────────────
        } else if (intent === "navigate") {
          const pageMap: Record<string, string> = {
            dashboard: "/dashboard", courses: "/courses", quizzes: "/quizzes",
            assignments: "/assignments", lectures: "/lectures", analytics: "/analytics",
            gradebook: "/gradebook", settings: "/settings",
            "quiz-builder": "/quizzes/new", "quiz builder": "/quizzes/new", "new quiz": "/quizzes/new",
          };
          const page = (params.page || "").toLowerCase();
          const path = pageMap[page] || "/dashboard";
          return { success: true, message: `🧭 Navigating to **${page || "dashboard"}**`, data: { navigateTo: path } };

        // ── CONVERSATIONAL QUESTION ──────────────────────────────────────────────
        } else if (intent === "question") {
          const q = params.question || command;
          const answerPrompt = `You are an expert assistant for EduAssess AI platform.
${contextBlock}
Answer this question accurately using the platform data above. Be concise, helpful, and specific.
If the question is about numbers (students, scores, etc.), calculate from the data.
Question: "${q}"`;
          const ansResult = await generateWithFallback({
            messages: [{ role: "user", content: answerPrompt }],
            maxTokens: 512,   // conversational answers are concise
          });
          return { success: true, message: ansResult.text };

        // ── HELP ─────────────────────────────────────────────────────────────────
        } else if (intent === "help") {
          return {
            success: true,
            message: `**🤖 EduAssess AI Co-pilot** — Here's everything I can do:\n\n` +
              `**📚 Courses:** Create, update, delete, list courses\n` +
              `**📝 Quizzes:** Create with AI questions, update settings, publish/unpublish, archive, delete, generate public links\n` +
              `**📋 Assignments:** Create with rubrics, update, publish, delete\n` +
              `**🎓 Lectures:** Create, update, summarize with AI, delete\n` +
              `**👥 Students:** Enroll/unenroll, show performance dashboard, list all students\n` +
              `**📊 Analytics:** Dashboard stats, gradebook, quiz submissions\n` +
              `**🤖 AI Features:** Generate questions on any topic, AI-grade assignments, summarize lectures\n` +
              `**💬 Questions:** Ask me anything about your platform ("How many students passed?", "What's my most popular quiz?")\n\n` +
              `**Chain commands:** "Create a Biology course, add a 10-question quiz on cell division, then publish it"\n` +
              `**Update settings:** "Set the Midterm Quiz time limit to 45 minutes and passing score to 70%"\n` +
              `**Natural language:** "Show me who submitted the final assignment"`,
          };

        } else {
          // Unknown intent — try to answer as a question
          const answerPrompt = `You are an expert assistant for EduAssess AI platform.
${contextBlock}
The user said: "${command}"
I couldn't determine a specific action. Answer their query or explain what you can do. Be helpful and concise.`;
          const ansResult = await generateWithFallback({
            messages: [{ role: "user", content: answerPrompt }],
            maxTokens: 512,   // unknown intent fallback — keep it brief
          });
          return { success: true, message: ansResult.text };
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
        let taskResult: { success: boolean; message: string; data?: any };
        try {
          taskResult = await executeTask(task.intent, taskParams);
        } catch (taskErr: any) {
          const taskErrMsg = String(taskErr?.message || taskErr || "");
          // Re-throw credit/402 errors — outer catch will return proper 402 response
          if (taskErrMsg.includes("402") || taskErrMsg.toLowerCase().includes("insufficient_credits")) {
            throw taskErr;
          }
          console.error(`Task "${task.intent}" threw an error:`, taskErr);
          taskResult = { success: false, message: `⚠️ Task "${task.intent}" encountered an error: ${taskErrMsg || "Unknown error"}` };
        }
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
    } catch (error: any) {
      console.error("Chat command error:", error);
      const msg = error?.message || "";
      if (msg.includes("402") || msg.toLowerCase().includes("credit") || msg.toLowerCase().includes("insufficient")) {
        return res.status(402).json({ error: "AI provider has insufficient credits. Please top up your balance or switch to a different AI provider in Settings.", provider: "insufficient_credits" });
      }
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

  // ── Quiz Submissions ─────────────────────────────────────────────────────────

  // Get a single quiz submission (student owns it or instructor)
  app.get("/api/quiz-submissions/:id", requireAuth, async (req, res) => {
    try {
      const submission = await storage.getQuizSubmission(req.params.id);
      if (!submission) return res.status(404).json({ error: "Submission not found" });
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ error: "Not found" });
      // Students can only view their own submissions
      if (user.role === "student" && submission.studentId !== req.session.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const quiz = await storage.getQuiz(submission.quizId);
      const quizQuestions = await storage.getQuizQuestions(submission.quizId);
      res.json({ submission, quiz, questions: quizQuestions });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch submission" });
    }
  });

  // All submissions for a quiz (instructor)
  app.get("/api/quiz/:id/submissions", requireInstructor, async (req, res) => {
    try {
      const submissions = await storage.getQuizSubmissions(req.params.id);
      const enriched = await Promise.all(
        submissions.map(async (s) => {
          const student = await storage.getUser(s.studentId);
          const violations = await storage.getProctoringViolations(s.id);
          return { ...s, studentName: student?.name ?? "Unknown", violationCount: violations.length };
        })
      );
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  // Proctoring violations for a submission
  app.get("/api/proctoring/violations/:submissionId", requireAuth, async (req, res) => {
    try {
      const submission = await storage.getQuizSubmission(req.params.submissionId);
      if (!submission) return res.status(404).json({ error: "Submission not found" });
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ error: "Not found" });
      if (user.role === "student" && submission.studentId !== req.session.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const violations = await storage.getProctoringViolations(req.params.submissionId);
      res.json(violations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch violations" });
    }
  });

  // Review/unreview a proctoring violation (instructor)
  app.patch("/api/proctoring/violations/:id/review", requireInstructor, async (req, res) => {
    try {
      const { reviewed, reviewNote } = req.body;
      const updated = await storage.updateProctoringViolation(req.params.id, {
        reviewed: !!reviewed,
        reviewNote: reviewNote ?? null,
      });
      if (!updated) return res.status(404).json({ error: "Violation not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update violation" });
    }
  });

  // ── Assignments (extended) ───────────────────────────────────────────────────

  // Get a single assignment
  app.get("/api/assignments/:id", requireAuth, async (req, res) => {
    try {
      const assignment = await storage.getAssignment(req.params.id);
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assignment" });
    }
  });

  // Student submits an assignment
  app.post("/api/assignment/:id/submit", requireAuth, async (req, res) => {
    try {
      const assignment = await storage.getAssignment(req.params.id);
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      const studentId = req.session.userId!;

      // Check enrollment
      const enrollments = await storage.getEnrollments(assignment.courseId, studentId);
      if (enrollments.length === 0) {
        return res.status(403).json({ error: "Not enrolled in this course" });
      }

      // Check due date
      const now = new Date();
      const isLate = assignment.dueDate && now > new Date(assignment.dueDate);
      if (isLate && !assignment.allowLateSubmission) {
        return res.status(403).json({ error: "Assignment past due date and late submissions are not allowed" });
      }

      const { content, fileUrl } = req.body;

      // Check for existing submission to update
      const existingSubs = await storage.getAssignmentSubmissions(assignment.id, studentId);
      let submission;
      if (existingSubs.length > 0) {
        submission = await storage.updateAssignmentSubmission(existingSubs[0].id, {
          content: content ?? null,
          fileUrl: fileUrl ?? null,
          status: "submitted",
          submittedAt: new Date(),
        });
      } else {
        submission = await storage.createAssignmentSubmission({
          assignmentId: assignment.id,
          studentId,
          content: content ?? null,
          fileUrl: fileUrl ?? null,
          status: "submitted",
          submittedAt: new Date(),
        });
      }
      res.status(201).json({ submission, isLate: !!isLate, latePenaltyPercent: isLate ? assignment.latePenaltyPercent : 0 });
    } catch (error) {
      console.error("Submit assignment error:", error);
      res.status(500).json({ error: "Failed to submit assignment" });
    }
  });

  // All submissions for an assignment (instructor)
  app.get("/api/assignments/:id/submissions", requireInstructor, async (req, res) => {
    try {
      const submissions = await storage.getAssignmentSubmissions(req.params.id);
      const enriched = await Promise.all(
        submissions.map(async (s) => {
          const student = await storage.getUser(s.studentId);
          return { ...s, studentName: student?.name ?? "Unknown" };
        })
      );
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  // Get a single assignment submission
  app.get("/api/assignment-submissions/:id", requireAuth, async (req, res) => {
    try {
      const submission = await storage.getAssignmentSubmission(req.params.id);
      if (!submission) return res.status(404).json({ error: "Submission not found" });
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ error: "Not found" });
      if (user.role === "student" && submission.studentId !== req.session.userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const assignment = await storage.getAssignment(submission.assignmentId);
      const student = await storage.getUser(submission.studentId);
      res.json({ submission, assignment, studentName: student?.name ?? "Unknown" });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch submission" });
    }
  });

  // Instructor manually grades an assignment submission
  app.patch("/api/assignment-submissions/:id/grade", requireInstructor, async (req, res) => {
    try {
      const { score, instructorFeedback, rubricScores } = req.body;
      const updated = await storage.updateAssignmentSubmission(req.params.id, {
        score: score ?? null,
        instructorFeedback: instructorFeedback ?? null,
        rubricScores: rubricScores ?? null,
        status: "graded",
        gradedAt: new Date(),
      });
      if (!updated) return res.status(404).json({ error: "Submission not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to grade submission" });
    }
  });

  // AI grade a single assignment submission
  app.post("/api/assignment-submissions/:id/ai-grade", requireInstructor, async (req, res) => {
    try {
      const submission = await storage.getAssignmentSubmission(req.params.id);
      if (!submission) return res.status(404).json({ error: "Submission not found" });
      const assignment = await storage.getAssignment(submission.assignmentId);
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      if (!submission.content && !submission.fileUrl) {
        return res.status(400).json({ error: "Submission has no content to grade" });
      }

      const aiUser = await getAiUser(req.session.userId);
      const rubricText = assignment.rubric
        ? assignment.rubric.map((r: any) => `- ${r.criterion} (${r.maxPoints} pts): ${r.description}`).join("\n")
        : "No rubric defined - grade based on quality and completeness.";

      const prompt = `You are an expert academic grader. Grade this student submission according to the provided rubric.

Assignment: ${assignment.title}
Instructions: ${assignment.instructions || assignment.description || "Complete the assignment as described."}
Max Score: ${assignment.maxScore} points

Rubric:
${rubricText}

Student Submission:
${submission.content || "[File submission - grade based on assignment requirements]"}

Grade each rubric criterion independently. Provide constructive feedback.

Respond in JSON format ONLY:
{
  "rubricScores": [
    { "criterion": "criterion name exactly as listed", "score": <number>, "feedback": "specific feedback" }
  ],
  "totalScore": <sum of all criterion scores, max ${assignment.maxScore}>,
  "overallFeedback": "2-3 sentence overall assessment",
  "strengths": "what the student did well",
  "improvements": "specific areas to improve"
}`;

      const aiGradeResult = await generateWithProvider({
        maxTokens: 768,   // rubric JSON + feedback fits in ~600 tokens; 768 gives room to breathe
        messages: [{ role: "user", content: prompt }],
      }, aiUser);
      const text = aiGradeResult.text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(500).json({ error: "AI failed to produce a grade" });
      const graded = JSON.parse(jsonMatch[0]);
      const aiFeedback = `${graded.overallFeedback}\n\nStrengths: ${graded.strengths}\n\nAreas for Improvement: ${graded.improvements}`;
      const updated = await storage.updateAssignmentSubmission(req.params.id, {
        score: Math.min(graded.totalScore, assignment.maxScore),
        rubricScores: graded.rubricScores,
        aiFeedback,
        status: "graded",
        gradedAt: new Date(),
      });
      res.json({ submission: updated, graded });
    } catch (error) {
      console.error("AI grade error:", error);
      res.status(500).json({ error: "Failed to AI grade submission" });
    }
  });

  // AI detect content (is it AI-written?)
  app.post("/api/assignment-submissions/:id/detect-ai", requireInstructor, async (req, res) => {
    try {
      const submission = await storage.getAssignmentSubmission(req.params.id);
      if (!submission) return res.status(404).json({ error: "Submission not found" });
      if (!submission.content) return res.status(400).json({ error: "No text content to analyze" });

      const aiUser = await getAiUser(req.session.userId);
      const prompt = `Analyze the following text and determine if it was written by a human or generated by an AI language model (like ChatGPT, Gemini, etc).

Look for these AI indicators:
- Overly structured, formulaic writing
- Repetitive transition phrases ("Furthermore", "Moreover", "In conclusion")
- Unnaturally balanced arguments without personal opinion
- Lack of personal voice, anecdotes, or first-hand perspective
- Hedging language ("It is important to note", "It can be argued")
- Absence of typos, colloquialisms, or informal language
- Generic, non-specific examples

Text to analyze:
${submission.content}

Respond in JSON format ONLY:
{
  "aiProbability": <integer 0-100, where 100 means certainly AI-written>,
  "confidence": "low" | "medium" | "high",
  "indicators": ["specific observed pattern 1", "specific observed pattern 2"],
  "reasoning": "2-3 sentence explanation of your assessment"
}`;

      const detectResult = await generateWithProvider({
        maxTokens: 512,   // AI detection JSON response with reasoning fits well under 512 tokens
        messages: [{ role: "user", content: prompt }],
      }, aiUser);
      const text = detectResult.text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(500).json({ error: "AI analysis failed" });
      const result = JSON.parse(jsonMatch[0]);
      await storage.updateAssignmentSubmission(req.params.id, {
        aiContentScore: result.aiProbability,
      });
      res.json(result);
    } catch (error) {
      console.error("AI detect error:", error);
      res.status(500).json({ error: "Failed to analyze content" });
    }
  });

  // Bulk AI grade all ungraded submissions for an assignment
  app.post("/api/assignments/:id/ai-grade-all", requireInstructor, async (req, res) => {
    try {
      const assignment = await storage.getAssignment(req.params.id);
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      const submissions = await storage.getAssignmentSubmissions(req.params.id);
      const ungraded = submissions.filter(s => s.status === "submitted" && (s.content || s.fileUrl));

      const aiUser = await getAiUser(req.session.userId);
      const rubricText = assignment.rubric
        ? assignment.rubric.map((r: any) => `- ${r.criterion} (${r.maxPoints} pts): ${r.description}`).join("\n")
        : "No rubric defined - grade on quality and completeness.";

      let gradedCount = 0;
      let failedCount = 0;
      for (const submission of ungraded) {
        try {
          const prompt = `You are an expert academic grader. Grade this student submission.
Assignment: ${assignment.title} | Max Score: ${assignment.maxScore} points
Rubric:\n${rubricText}
Student Submission:\n${submission.content || "[File submission]"}
Respond in JSON ONLY: { "rubricScores": [{"criterion": "...", "score": <n>, "feedback": "..."}], "totalScore": <n>, "overallFeedback": "...", "strengths": "...", "improvements": "..." }`;

          const bulkResult = await generateWithProvider({
            maxTokens: 768,   // same budget as single grade; same JSON shape
            messages: [{ role: "user", content: prompt }],
          }, aiUser);
          const jsonMatch = bulkResult.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const graded = JSON.parse(jsonMatch[0]);
            const aiFeedback = `${graded.overallFeedback}\n\nStrengths: ${graded.strengths}\n\nAreas for Improvement: ${graded.improvements}`;
            await storage.updateAssignmentSubmission(submission.id, {
              score: Math.min(graded.totalScore, assignment.maxScore),
              rubricScores: graded.rubricScores,
              aiFeedback,
              status: "graded",
              gradedAt: new Date(),
            });
            gradedCount++;
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      }
      res.json({ gradedCount, failedCount, totalProcessed: ungraded.length });
    } catch (error) {
      console.error("Bulk AI grade error:", error);
      res.status(500).json({ error: "Failed to bulk grade assignments" });
    }
  });

  // ── Gradebook ────────────────────────────────────────────────────────────────

  app.get("/api/courses/:id/gradebook", requireInstructor, async (req, res) => {
    try {
      const gradebook = await storage.getGradebook(req.params.id);
      res.json(gradebook);
    } catch (error) {
      console.error("Gradebook error:", error);
      res.status(500).json({ error: "Failed to fetch gradebook" });
    }
  });

  app.get("/api/student/grades", requireAuth, async (req, res) => {
    try {
      const performance = await storage.getStudentPerformance(req.session.userId!);
      res.json(performance);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch grades" });
    }
  });

  // ── Student Performance ──────────────────────────────────────────────────────

  app.get("/api/students/:id/performance", requireInstructor, async (req, res) => {
    try {
      const performance = await storage.getStudentPerformance(req.params.id);
      res.json(performance);
    } catch (error) {
      console.error("Student performance error:", error);
      res.status(500).json({ error: "Failed to fetch student performance" });
    }
  });

  app.get("/api/student/performance", requireAuth, async (req, res) => {
    try {
      const performance = await storage.getStudentPerformance(req.session.userId!);
      res.json(performance);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch performance" });
    }
  });

  return httpServer;
}
