import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "instructor", "student"]);
export const questionTypeEnum = pgEnum("question_type", ["mcq", "true_false", "short_answer", "essay", "fill_blank", "matching"]);
export const assessmentStatusEnum = pgEnum("assessment_status", ["draft", "published", "closed"]);
export const submissionStatusEnum = pgEnum("submission_status", ["in_progress", "submitted", "graded"]);
export const violationTypeEnum = pgEnum("violation_type", ["tab_switch", "copy_paste", "multiple_faces", "no_face", "phone_detected", "unauthorized_person", "looking_away", "suspicious_behavior"]);
export const publicLinkPermissionEnum = pgEnum("public_link_permission", ["view", "attempt"]);
export const chatCommandStatusEnum = pgEnum("chat_command_status", ["pending", "executing", "completed", "failed"]);

// Supported AI providers
export const AI_PROVIDERS = ["gemini", "openai", "openrouter", "grok", "kimi", "anthropic", "custom"] as const;
export type AiProvider = typeof AI_PROVIDERS[number];

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull().default("student"),
  avatarUrl: text("avatar_url"),
  // AI provider keys
  geminiApiKey: text("gemini_api_key"),
  openaiApiKey: text("openai_api_key"),
  openrouterApiKey: text("openrouter_api_key"),
  grokApiKey: text("grok_api_key"),
  kimiApiKey: text("kimi_api_key"),
  anthropicApiKey: text("anthropic_api_key"),
  customApiKey: text("custom_api_key"),
  customApiBaseUrl: text("custom_api_base_url"),
  customApiModel: text("custom_api_model"),
  // Which provider is currently active
  activeAiProvider: text("active_ai_provider").default("gemini"),
  patternHash: text("pattern_hash"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Courses table
export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull(),
  description: text("description"),
  semester: text("semester").notNull(),
  instructorId: varchar("instructor_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Lectures table
export const lectures = pgTable("lectures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  unit: text("unit"),
  fileUrl: text("file_url"),
  fileType: text("file_type"),
  summary: text("summary"),
  keyPoints: jsonb("key_points").$type<string[]>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Question Bank table
export const questions = pgTable("questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").references(() => courses.id, { onDelete: "cascade" }),
  lectureId: varchar("lecture_id").references(() => lectures.id, { onDelete: "set null" }),
  type: questionTypeEnum("type").notNull(),
  difficulty: text("difficulty").notNull().default("medium"),
  text: text("text").notNull(),
  options: jsonb("options").$type<string[]>(),
  correctAnswer: text("correct_answer").notNull(),
  explanation: text("explanation"),
  points: integer("points").notNull().default(1),
  tags: jsonb("tags").$type<string[]>(),
  imageUrl: text("image_url"),
  aiGenerated: boolean("ai_generated").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Quizzes table
export const quizzes = pgTable("quizzes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  instructions: text("instructions"),
  timeLimitMinutes: integer("time_limit_minutes"),
  passingScore: integer("passing_score").default(60),
  randomizeQuestions: boolean("randomize_questions").default(true),
  randomizeOptions: boolean("randomize_options").default(true),
  showResults: boolean("show_results").default(true),
  proctored: boolean("proctored").default(false),
  violationThreshold: integer("violation_threshold").default(5),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"),
  attachmentName: text("attachment_name"),
  status: assessmentStatusEnum("status").notNull().default("draft"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  publicAccessToken: varchar("public_access_token"),
  publicLinkPermission: publicLinkPermissionEnum("public_link_permission"),
  publicLinkEnabled: boolean("public_link_enabled").default(false),
  requiredIdentificationFields: jsonb("required_identification_fields").$type<string[]>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Quiz Questions junction table
export const quizQuestions = pgTable("quiz_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quizId: varchar("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  questionId: varchar("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
});

// Assignments table
export const assignments = pgTable("assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  instructions: text("instructions"),
  rubric: jsonb("rubric").$type<{ criterion: string; maxPoints: number; description: string }[]>(),
  maxScore: integer("max_score").notNull().default(100),
  allowLateSubmission: boolean("allow_late_submission").default(false),
  latePenaltyPercent: integer("late_penalty_percent").default(10),
  status: assessmentStatusEnum("status").notNull().default("draft"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Course Enrollments
export const enrollments = pgTable("enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  studentId: varchar("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  enrolledAt: timestamp("enrolled_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Quiz Submissions
export const quizSubmissions = pgTable("quiz_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quizId: varchar("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  studentId: varchar("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<{ questionId: string; answer: string; isCorrect?: boolean; points?: number }[]>(),
  score: integer("score"),
  totalPoints: integer("total_points"),
  percentage: integer("percentage"),
  status: submissionStatusEnum("status").notNull().default("in_progress"),
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  submittedAt: timestamp("submitted_at"),
  gradedAt: timestamp("graded_at"),
  aiFeedback: text("ai_feedback"),
});

// Assignment Submissions
export const assignmentSubmissions = pgTable("assignment_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => assignments.id, { onDelete: "cascade" }),
  studentId: varchar("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content"),
  fileUrl: text("file_url"),
  score: integer("score"),
  status: submissionStatusEnum("status").notNull().default("in_progress"),
  plagiarismScore: integer("plagiarism_score"),
  aiContentScore: integer("ai_content_score"),
  rubricScores: jsonb("rubric_scores").$type<{ criterion: string; score: number; feedback: string }[]>(),
  instructorFeedback: text("instructor_feedback"),
  aiFeedback: text("ai_feedback"),
  submittedAt: timestamp("submitted_at"),
  gradedAt: timestamp("graded_at"),
});

// Proctoring Violations
export const proctoringViolations = pgTable("proctoring_violations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull().references(() => quizSubmissions.id, { onDelete: "cascade" }),
  type: violationTypeEnum("type").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("medium"),
  screenshotUrl: text("screenshot_url"),
  timestamp: timestamp("timestamp").default(sql`CURRENT_TIMESTAMP`).notNull(),
  reviewed: boolean("reviewed").default(false),
  reviewNote: text("review_note"),
});

// Public Quiz Submissions (for anonymous/guest users via public link)
export const publicQuizSubmissions = pgTable("public_quiz_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quizId: varchar("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  identificationData: jsonb("identification_data").$type<Record<string, string>>(),
  answers: jsonb("answers").$type<{ questionId: string; answer: string; isCorrect?: boolean; points?: number }[]>(),
  score: integer("score"),
  totalPoints: integer("total_points"),
  percentage: integer("percentage"),
  status: submissionStatusEnum("status").notNull().default("in_progress"),
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  submittedAt: timestamp("submitted_at"),
  ipAddress: text("ip_address"),
});

// Password Reset Tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Chat Commands (for agentic chatbot)
export const chatCommands = pgTable("chat_commands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conversationId: integer("conversation_id"),
  command: text("command").notNull(),
  intent: text("intent"),
  parameters: jsonb("parameters").$type<Record<string, any>>(),
  status: chatCommandStatusEnum("status").notNull().default("pending"),
  result: jsonb("result").$type<{ success: boolean; message: string; data?: any }>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  courses: many(courses),
  enrollments: many(enrollments),
  quizSubmissions: many(quizSubmissions),
  assignmentSubmissions: many(assignmentSubmissions),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  instructor: one(users, { fields: [courses.instructorId], references: [users.id] }),
  lectures: many(lectures),
  quizzes: many(quizzes),
  assignments: many(assignments),
  enrollments: many(enrollments),
  questions: many(questions),
}));

export const lecturesRelations = relations(lectures, ({ one, many }) => ({
  course: one(courses, { fields: [lectures.courseId], references: [courses.id] }),
  questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  course: one(courses, { fields: [questions.courseId], references: [courses.id] }),
  lecture: one(lectures, { fields: [questions.lectureId], references: [lectures.id] }),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  course: one(courses, { fields: [quizzes.courseId], references: [courses.id] }),
  quizQuestions: many(quizQuestions),
  submissions: many(quizSubmissions),
}));

export const quizQuestionsRelations = relations(quizQuestions, ({ one }) => ({
  quiz: one(quizzes, { fields: [quizQuestions.quizId], references: [quizzes.id] }),
  question: one(questions, { fields: [quizQuestions.questionId], references: [questions.id] }),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  course: one(courses, { fields: [assignments.courseId], references: [courses.id] }),
  submissions: many(assignmentSubmissions),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  course: one(courses, { fields: [enrollments.courseId], references: [courses.id] }),
  student: one(users, { fields: [enrollments.studentId], references: [users.id] }),
}));

export const quizSubmissionsRelations = relations(quizSubmissions, ({ one, many }) => ({
  quiz: one(quizzes, { fields: [quizSubmissions.quizId], references: [quizzes.id] }),
  student: one(users, { fields: [quizSubmissions.studentId], references: [users.id] }),
  violations: many(proctoringViolations),
}));

export const assignmentSubmissionsRelations = relations(assignmentSubmissions, ({ one }) => ({
  assignment: one(assignments, { fields: [assignmentSubmissions.assignmentId], references: [assignments.id] }),
  student: one(users, { fields: [assignmentSubmissions.studentId], references: [users.id] }),
}));

export const proctoringViolationsRelations = relations(proctoringViolations, ({ one }) => ({
  submission: one(quizSubmissions, { fields: [proctoringViolations.submissionId], references: [quizSubmissions.id] }),
}));

// Chat models export (for Gemini integration)
export * from "./models/chat";

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertCourseSchema = createInsertSchema(courses).omit({ id: true, createdAt: true });
export const insertLectureSchema = createInsertSchema(lectures).omit({ id: true, createdAt: true });
export const insertQuestionSchema = createInsertSchema(questions).omit({ id: true, createdAt: true });
export const insertQuizSchema = createInsertSchema(quizzes).omit({ id: true, createdAt: true });
export const insertQuizQuestionSchema = createInsertSchema(quizQuestions).omit({ id: true });
export const insertAssignmentSchema = createInsertSchema(assignments).omit({ id: true, createdAt: true });
export const insertEnrollmentSchema = createInsertSchema(enrollments).omit({ id: true, enrolledAt: true });
export const insertQuizSubmissionSchema = createInsertSchema(quizSubmissions).omit({ id: true, startedAt: true });
export const insertAssignmentSubmissionSchema = createInsertSchema(assignmentSubmissions).omit({ id: true });
export const insertProctoringViolationSchema = createInsertSchema(proctoringViolations).omit({ id: true, timestamp: true });
export const insertPublicQuizSubmissionSchema = createInsertSchema(publicQuizSubmissions).omit({ id: true, startedAt: true });
export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({ id: true, createdAt: true });
export const insertChatCommandSchema = createInsertSchema(chatCommands).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Lecture = typeof lectures.$inferSelect;
export type InsertLecture = z.infer<typeof insertLectureSchema>;
export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type InsertQuizQuestion = z.infer<typeof insertQuizQuestionSchema>;
export type Assignment = typeof assignments.$inferSelect;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;
export type QuizSubmission = typeof quizSubmissions.$inferSelect;
export type InsertQuizSubmission = z.infer<typeof insertQuizSubmissionSchema>;
export type AssignmentSubmission = typeof assignmentSubmissions.$inferSelect;
export type InsertAssignmentSubmission = z.infer<typeof insertAssignmentSubmissionSchema>;
export type ProctoringViolation = typeof proctoringViolations.$inferSelect;
export type InsertProctoringViolation = z.infer<typeof insertProctoringViolationSchema>;
export type PublicQuizSubmission = typeof publicQuizSubmissions.$inferSelect;
export type InsertPublicQuizSubmission = z.infer<typeof insertPublicQuizSubmissionSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type ChatCommand = typeof chatCommands.$inferSelect;
export type InsertChatCommand = z.infer<typeof insertChatCommandSchema>;

// Extended types for frontend
export type QuestionType = "mcq" | "true_false" | "short_answer" | "essay" | "fill_blank" | "matching";
export type UserRole = "admin" | "instructor" | "student";
export type AssessmentStatus = "draft" | "published" | "closed";
export type SubmissionStatus = "in_progress" | "submitted" | "graded";
export type ViolationType = "tab_switch" | "copy_paste" | "multiple_faces" | "no_face" | "phone_detected" | "unauthorized_person" | "looking_away" | "suspicious_behavior";
export type PublicLinkPermission = "view" | "attempt";
export type ChatCommandStatus = "pending" | "executing" | "completed" | "failed";
