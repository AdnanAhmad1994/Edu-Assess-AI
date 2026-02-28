import {
  type User, type InsertUser,
  type Course, type InsertCourse,
  type Lecture, type InsertLecture,
  type Question, type InsertQuestion,
  type Quiz, type InsertQuiz,
  type QuizQuestion, type InsertQuizQuestion,
  type Assignment, type InsertAssignment,
  type Enrollment, type InsertEnrollment,
  type QuizSubmission, type InsertQuizSubmission,
  type AssignmentSubmission, type InsertAssignmentSubmission,
  type ProctoringViolation, type InsertProctoringViolation,
  type PublicQuizSubmission, type InsertPublicQuizSubmission,
  type PasswordResetToken, type InsertPasswordResetToken,
  type ChatCommand, type InsertChatCommand,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUsers(role?: string): Promise<User[]>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  
  // Courses
  getCourses(instructorId?: string): Promise<Course[]>;
  getCourse(id: string): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: string, course: Partial<InsertCourse>): Promise<Course | undefined>;
  deleteCourse(id: string): Promise<void>;
  
  // Lectures
  getLectures(courseId?: string): Promise<Lecture[]>;
  getLecture(id: string): Promise<Lecture | undefined>;
  createLecture(lecture: InsertLecture): Promise<Lecture>;
  updateLecture(id: string, lecture: Partial<InsertLecture>): Promise<Lecture | undefined>;
  deleteLecture(id: string): Promise<void>;
  
  // Questions
  getQuestions(courseId?: string, lectureId?: string): Promise<Question[]>;
  getQuestion(id: string): Promise<Question | undefined>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  createQuestions(questions: InsertQuestion[]): Promise<Question[]>;
  updateQuestion(id: string, question: Partial<InsertQuestion>): Promise<Question | undefined>;
  deleteQuestion(id: string): Promise<void>;
  
  // Quizzes
  getQuizzes(courseId?: string): Promise<Quiz[]>;
  getQuiz(id: string): Promise<Quiz | undefined>;
  createQuiz(quiz: InsertQuiz): Promise<Quiz>;
  updateQuiz(id: string, quiz: Partial<InsertQuiz>): Promise<Quiz | undefined>;
  deleteQuiz(id: string): Promise<void>;
  
  // Quiz Questions
  getQuizQuestions(quizId: string): Promise<(QuizQuestion & { question: Question })[]>;
  addQuizQuestion(quizQuestion: InsertQuizQuestion): Promise<QuizQuestion>;
  removeQuizQuestion(quizId: string, questionId: string): Promise<void>;
  
  // Assignments
  getAssignments(courseId?: string): Promise<Assignment[]>;
  getAssignment(id: string): Promise<Assignment | undefined>;
  createAssignment(assignment: InsertAssignment): Promise<Assignment>;
  updateAssignment(id: string, assignment: Partial<InsertAssignment>): Promise<Assignment | undefined>;
  deleteAssignment(id: string): Promise<void>;
  
  // Enrollments
  getEnrollments(courseId?: string, studentId?: string): Promise<Enrollment[]>;
  createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment>;
  deleteEnrollment(courseId: string, studentId: string): Promise<void>;
  
  // Quiz Submissions
  getQuizSubmissions(quizId?: string, studentId?: string): Promise<QuizSubmission[]>;
  getQuizSubmission(id: string): Promise<QuizSubmission | undefined>;
  createQuizSubmission(submission: InsertQuizSubmission): Promise<QuizSubmission>;
  updateQuizSubmission(id: string, submission: Partial<QuizSubmission>): Promise<QuizSubmission | undefined>;
  
  // Assignment Submissions
  getAssignmentSubmissions(assignmentId?: string, studentId?: string): Promise<AssignmentSubmission[]>;
  getAssignmentSubmission(id: string): Promise<AssignmentSubmission | undefined>;
  createAssignmentSubmission(submission: InsertAssignmentSubmission): Promise<AssignmentSubmission>;
  updateAssignmentSubmission(id: string, submission: Partial<AssignmentSubmission>): Promise<AssignmentSubmission | undefined>;
  
  // Proctoring Violations
  getProctoringViolations(submissionId: string): Promise<ProctoringViolation[]>;
  createProctoringViolation(violation: InsertProctoringViolation): Promise<ProctoringViolation>;
  updateProctoringViolation(id: string, data: Partial<ProctoringViolation>): Promise<ProctoringViolation | undefined>;
  
  // Public Quiz Submissions
  getPublicQuizSubmissions(quizId: string): Promise<PublicQuizSubmission[]>;
  getPublicQuizSubmission(id: string): Promise<PublicQuizSubmission | undefined>;
  createPublicQuizSubmission(submission: InsertPublicQuizSubmission): Promise<PublicQuizSubmission>;
  updatePublicQuizSubmission(id: string, submission: Partial<PublicQuizSubmission>): Promise<PublicQuizSubmission | undefined>;
  
  // Quiz Public Link
  getQuizByPublicToken(token: string): Promise<Quiz | undefined>;
  generateQuizPublicLink(quizId: string, permission: "view" | "attempt", requiredFields: string[]): Promise<Quiz | undefined>;
  
  // Chat Commands
  getChatCommands(userId: string): Promise<ChatCommand[]>;
  getChatCommand(id: string): Promise<ChatCommand | undefined>;
  createChatCommand(command: InsertChatCommand): Promise<ChatCommand>;
  updateChatCommand(id: string, command: Partial<ChatCommand>): Promise<ChatCommand | undefined>;
  
  // Password Reset Tokens
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;

  // Stats
  getDashboardStats(instructorId: string): Promise<{
    totalCourses: number;
    totalQuizzes: number;
    totalAssignments: number;
    totalStudents: number;
    pendingGrading: number;
    recentSubmissions: number;
  }>;

  // Analytics
  getCourseAnalytics(courseId?: string, instructorId?: string): Promise<{
    overview: { totalStudents: number; averageScore: number; passRate: number; totalSubmissions: number };
    scoreDistribution: { range: string; count: number }[];
    performanceTrend: { date: string; average: number }[];
    topPerformers: { studentId: string; name: string; score: number; quizCount: number }[];
    lowPerformers: { studentId: string; name: string; score: number; quizCount: number }[];
    quizStats: { quizId: string; name: string; avgScore: number; submissions: number; passRate: number }[];
    violationStats: { type: string; count: number }[];
  }>;

  // Gradebook
  getGradebook(courseId: string): Promise<{
    course: Course;
    quizzes: Quiz[];
    assignments: Assignment[];
    students: Array<{
      student: User;
      quizResults: Array<{ quizId: string; quizTitle: string; score: number | null; percentage: number | null; status: string }>;
      assignmentResults: Array<{ assignmentId: string; assignmentTitle: string; score: number | null; maxScore: number; status: string }>;
      overallAverage: number | null;
    }>;
    quizSummary: Array<{ quizId: string; title: string; best: number | null; worst: number | null; average: number | null; count: number }>;
    assignmentSummary: Array<{ assignmentId: string; title: string; best: number | null; worst: number | null; average: number | null; count: number }>;
  }>;

  // Student Performance
  getStudentPerformance(studentId: string): Promise<{
    student: User;
    enrolledCourses: Course[];
    quizSubmissions: Array<QuizSubmission & { quizTitle: string; courseId: string; courseName: string }>;
    assignmentSubmissions: Array<AssignmentSubmission & { assignmentTitle: string; courseId: string; courseName: string }>;
    proctoringViolations: ProctoringViolation[];
    stats: {
      totalQuizzesTaken: number;
      averageQuizScore: number;
      bestQuizScore: number;
      worstQuizScore: number;
      totalAssignmentsSubmitted: number;
      averageAssignmentScore: number;
      totalViolations: number;
    };
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private courses: Map<string, Course> = new Map();
  private lectures: Map<string, Lecture> = new Map();
  private questions: Map<string, Question> = new Map();
  private quizzes: Map<string, Quiz> = new Map();
  private quizQuestions: Map<string, QuizQuestion> = new Map();
  private assignments: Map<string, Assignment> = new Map();
  private enrollments: Map<string, Enrollment> = new Map();
  private quizSubmissions: Map<string, QuizSubmission> = new Map();
  private assignmentSubmissions: Map<string, AssignmentSubmission> = new Map();
  private proctoringViolations: Map<string, ProctoringViolation> = new Map();
  private publicQuizSubmissions: Map<string, PublicQuizSubmission> = new Map();
  private chatCommands: Map<string, ChatCommand> = new Map();
  private passwordResetTokens: Map<string, PasswordResetToken> = new Map();

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUsers(role?: string): Promise<User[]> {
    const allUsers = Array.from(this.users.values());
    if (role) return allUsers.filter(u => u.role === role);
    return allUsers;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      role: insertUser.role ?? "student",
      avatarUrl: insertUser.avatarUrl ?? null,
      geminiApiKey: insertUser.geminiApiKey ?? null,
      patternHash: insertUser.patternHash ?? null,
      // Multi-provider AI keys (all nullable by default)
      openaiApiKey: insertUser.openaiApiKey ?? null,
      openrouterApiKey: insertUser.openrouterApiKey ?? null,
      grokApiKey: insertUser.grokApiKey ?? null,
      kimiApiKey: insertUser.kimiApiKey ?? null,
      anthropicApiKey: insertUser.anthropicApiKey ?? null,
      customApiKey: insertUser.customApiKey ?? null,
      customApiBaseUrl: insertUser.customApiBaseUrl ?? null,
      customApiModel: insertUser.customApiModel ?? null,
      activeAiProvider: insertUser.activeAiProvider ?? "gemini",
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...data, id };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id);
  }

  // Courses
  async getCourses(instructorId?: string): Promise<Course[]> {
    const courses = Array.from(this.courses.values());
    if (instructorId) {
      return courses.filter(c => c.instructorId === instructorId);
    }
    return courses;
  }

  async getCourse(id: string): Promise<Course | undefined> {
    return this.courses.get(id);
  }

  async createCourse(insertCourse: InsertCourse): Promise<Course> {
    const id = randomUUID();
    const course: Course = {
      ...insertCourse,
      id,
      description: insertCourse.description ?? null,
      createdAt: new Date(),
    };
    this.courses.set(id, course);
    return course;
  }

  async updateCourse(id: string, data: Partial<InsertCourse>): Promise<Course | undefined> {
    const course = this.courses.get(id);
    if (!course) return undefined;
    const updated = { ...course, ...data };
    this.courses.set(id, updated);
    return updated;
  }

  async deleteCourse(id: string): Promise<void> {
    this.courses.delete(id);
  }

  // Lectures
  async getLectures(courseId?: string): Promise<Lecture[]> {
    const lectures = Array.from(this.lectures.values());
    if (courseId) {
      return lectures.filter(l => l.courseId === courseId);
    }
    return lectures;
  }

  async getLecture(id: string): Promise<Lecture | undefined> {
    return this.lectures.get(id);
  }

  async createLecture(insertLecture: InsertLecture): Promise<Lecture> {
    const id = randomUUID();
    const lecture: Lecture = {
      ...insertLecture,
      id,
      description: insertLecture.description ?? null,
      unit: insertLecture.unit ?? null,
      fileUrl: insertLecture.fileUrl ?? null,
      fileType: insertLecture.fileType ?? null,
      summary: insertLecture.summary ?? null,
      keyPoints: insertLecture.keyPoints ?? null,
      createdAt: new Date(),
    };
    this.lectures.set(id, lecture);
    return lecture;
  }

  async updateLecture(id: string, data: Partial<InsertLecture>): Promise<Lecture | undefined> {
    const lecture = this.lectures.get(id);
    if (!lecture) return undefined;
    const updated = { ...lecture, ...data };
    this.lectures.set(id, updated);
    return updated;
  }

  async deleteLecture(id: string): Promise<void> {
    this.lectures.delete(id);
  }

  // Questions
  async getQuestions(courseId?: string, lectureId?: string): Promise<Question[]> {
    let questions = Array.from(this.questions.values());
    if (courseId) {
      questions = questions.filter(q => q.courseId === courseId);
    }
    if (lectureId) {
      questions = questions.filter(q => q.lectureId === lectureId);
    }
    return questions;
  }

  async getQuestion(id: string): Promise<Question | undefined> {
    return this.questions.get(id);
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const id = randomUUID();
    const question: Question = {
      ...insertQuestion,
      id,
      courseId: insertQuestion.courseId ?? null,
      lectureId: insertQuestion.lectureId ?? null,
      difficulty: insertQuestion.difficulty ?? "medium",
      options: insertQuestion.options ?? null,
      explanation: insertQuestion.explanation ?? null,
      points: insertQuestion.points ?? 1,
      tags: insertQuestion.tags ?? null,
      imageUrl: insertQuestion.imageUrl ?? null,
      aiGenerated: insertQuestion.aiGenerated ?? false,
      createdAt: new Date(),
    };
    this.questions.set(id, question);
    return question;
  }

  async createQuestions(insertQuestions: InsertQuestion[]): Promise<Question[]> {
    const created: Question[] = [];
    for (const q of insertQuestions) {
      created.push(await this.createQuestion(q));
    }
    return created;
  }

  async updateQuestion(id: string, data: Partial<InsertQuestion>): Promise<Question | undefined> {
    const question = this.questions.get(id);
    if (!question) return undefined;
    const updated = { ...question, ...data };
    this.questions.set(id, updated);
    return updated;
  }

  async deleteQuestion(id: string): Promise<void> {
    this.questions.delete(id);
  }

  // Quizzes
  async getQuizzes(courseId?: string): Promise<Quiz[]> {
    const quizzes = Array.from(this.quizzes.values());
    if (courseId) {
      return quizzes.filter(q => q.courseId === courseId);
    }
    return quizzes;
  }

  async getQuiz(id: string): Promise<Quiz | undefined> {
    return this.quizzes.get(id);
  }

  async createQuiz(insertQuiz: InsertQuiz): Promise<Quiz> {
    const id = randomUUID();
    const quiz: Quiz = {
      ...insertQuiz,
      id,
      description: insertQuiz.description ?? null,
      instructions: insertQuiz.instructions ?? null,
      timeLimitMinutes: insertQuiz.timeLimitMinutes ?? null,
      passingScore: insertQuiz.passingScore ?? 60,
      randomizeQuestions: insertQuiz.randomizeQuestions ?? true,
      randomizeOptions: insertQuiz.randomizeOptions ?? true,
      showResults: insertQuiz.showResults ?? true,
      proctored: insertQuiz.proctored ?? false,
      violationThreshold: insertQuiz.violationThreshold ?? null,
      attachmentUrl: insertQuiz.attachmentUrl ?? null,
      attachmentType: insertQuiz.attachmentType ?? null,
      attachmentName: insertQuiz.attachmentName ?? null,
      status: insertQuiz.status ?? "draft",
      startDate: insertQuiz.startDate ?? null,
      endDate: insertQuiz.endDate ?? null,
      publicAccessToken: insertQuiz.publicAccessToken ?? null,
      publicLinkPermission: insertQuiz.publicLinkPermission ?? null,
      publicLinkEnabled: insertQuiz.publicLinkEnabled ?? false,
      requiredIdentificationFields: insertQuiz.requiredIdentificationFields ?? null,
      createdAt: new Date(),
    };
    this.quizzes.set(id, quiz);
    return quiz;
  }

  async updateQuiz(id: string, data: Partial<InsertQuiz>): Promise<Quiz | undefined> {
    const quiz = this.quizzes.get(id);
    if (!quiz) return undefined;
    const updated = { ...quiz, ...data };
    this.quizzes.set(id, updated);
    return updated;
  }

  async deleteQuiz(id: string): Promise<void> {
    this.quizzes.delete(id);
  }

  // Quiz Questions
  async getQuizQuestions(quizId: string): Promise<(QuizQuestion & { question: Question })[]> {
    const quizQuestions = Array.from(this.quizQuestions.values())
      .filter(qq => qq.quizId === quizId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    
    const result: (QuizQuestion & { question: Question })[] = [];
    for (const qq of quizQuestions) {
      const question = await this.getQuestion(qq.questionId);
      if (question) {
        result.push({ ...qq, question });
      }
    }
    return result;
  }

  async addQuizQuestion(insertQuizQuestion: InsertQuizQuestion): Promise<QuizQuestion> {
    const id = randomUUID();
    const quizQuestion: QuizQuestion = { ...insertQuizQuestion, id };
    this.quizQuestions.set(id, quizQuestion);
    return quizQuestion;
  }

  async removeQuizQuestion(quizId: string, questionId: string): Promise<void> {
    for (const [id, qq] of this.quizQuestions) {
      if (qq.quizId === quizId && qq.questionId === questionId) {
        this.quizQuestions.delete(id);
        break;
      }
    }
  }

  // Assignments
  async getAssignments(courseId?: string): Promise<Assignment[]> {
    const assignments = Array.from(this.assignments.values());
    if (courseId) {
      return assignments.filter(a => a.courseId === courseId);
    }
    return assignments;
  }

  async getAssignment(id: string): Promise<Assignment | undefined> {
    return this.assignments.get(id);
  }

  async createAssignment(insertAssignment: InsertAssignment): Promise<Assignment> {
    const id = randomUUID();
    const assignment: Assignment = {
      ...insertAssignment,
      id,
      description: insertAssignment.description ?? null,
      instructions: insertAssignment.instructions ?? null,
      rubric: insertAssignment.rubric ?? null,
      maxScore: insertAssignment.maxScore ?? 100,
      allowLateSubmission: insertAssignment.allowLateSubmission ?? false,
      latePenaltyPercent: insertAssignment.latePenaltyPercent ?? 10,
      status: insertAssignment.status ?? "draft",
      dueDate: insertAssignment.dueDate ?? null,
      createdAt: new Date(),
    };
    this.assignments.set(id, assignment);
    return assignment;
  }

  async updateAssignment(id: string, data: Partial<InsertAssignment>): Promise<Assignment | undefined> {
    const assignment = this.assignments.get(id);
    if (!assignment) return undefined;
    const updated = { ...assignment, ...data };
    this.assignments.set(id, updated);
    return updated;
  }

  async deleteAssignment(id: string): Promise<void> {
    this.assignments.delete(id);
  }

  // Enrollments
  async getEnrollments(courseId?: string, studentId?: string): Promise<Enrollment[]> {
    let enrollments = Array.from(this.enrollments.values());
    if (courseId) {
      enrollments = enrollments.filter(e => e.courseId === courseId);
    }
    if (studentId) {
      enrollments = enrollments.filter(e => e.studentId === studentId);
    }
    return enrollments;
  }

  async createEnrollment(insertEnrollment: InsertEnrollment): Promise<Enrollment> {
    const id = randomUUID();
    const enrollment: Enrollment = {
      ...insertEnrollment,
      id,
      enrolledAt: new Date(),
    };
    this.enrollments.set(id, enrollment);
    return enrollment;
  }

  async deleteEnrollment(courseId: string, studentId: string): Promise<void> {
    for (const [id, e] of this.enrollments) {
      if (e.courseId === courseId && e.studentId === studentId) {
        this.enrollments.delete(id);
        break;
      }
    }
  }

  // Quiz Submissions
  async getQuizSubmissions(quizId?: string, studentId?: string): Promise<QuizSubmission[]> {
    let submissions = Array.from(this.quizSubmissions.values());
    if (quizId) {
      submissions = submissions.filter(s => s.quizId === quizId);
    }
    if (studentId) {
      submissions = submissions.filter(s => s.studentId === studentId);
    }
    return submissions;
  }

  async getQuizSubmission(id: string): Promise<QuizSubmission | undefined> {
    return this.quizSubmissions.get(id);
  }

  async createQuizSubmission(insertSubmission: InsertQuizSubmission): Promise<QuizSubmission> {
    const id = randomUUID();
    const submission: QuizSubmission = {
      ...insertSubmission,
      id,
      answers: insertSubmission.answers ?? null,
      score: insertSubmission.score ?? null,
      totalPoints: insertSubmission.totalPoints ?? null,
      percentage: insertSubmission.percentage ?? null,
      status: insertSubmission.status ?? "in_progress",
      submittedAt: insertSubmission.submittedAt ?? null,
      gradedAt: insertSubmission.gradedAt ?? null,
      aiFeedback: insertSubmission.aiFeedback ?? null,
      startedAt: new Date(),
    };
    this.quizSubmissions.set(id, submission);
    return submission;
  }

  async updateQuizSubmission(id: string, data: Partial<QuizSubmission>): Promise<QuizSubmission | undefined> {
    const submission = this.quizSubmissions.get(id);
    if (!submission) return undefined;
    const updated = { ...submission, ...data };
    this.quizSubmissions.set(id, updated);
    return updated;
  }

  // Assignment Submissions
  async getAssignmentSubmissions(assignmentId?: string, studentId?: string): Promise<AssignmentSubmission[]> {
    let submissions = Array.from(this.assignmentSubmissions.values());
    if (assignmentId) {
      submissions = submissions.filter(s => s.assignmentId === assignmentId);
    }
    if (studentId) {
      submissions = submissions.filter(s => s.studentId === studentId);
    }
    return submissions;
  }

  async getAssignmentSubmission(id: string): Promise<AssignmentSubmission | undefined> {
    return this.assignmentSubmissions.get(id);
  }

  async createAssignmentSubmission(insertSubmission: InsertAssignmentSubmission): Promise<AssignmentSubmission> {
    const id = randomUUID();
    const submission: AssignmentSubmission = {
      ...insertSubmission,
      id,
      content: insertSubmission.content ?? null,
      fileUrl: insertSubmission.fileUrl ?? null,
      score: insertSubmission.score ?? null,
      status: insertSubmission.status ?? "in_progress",
      plagiarismScore: insertSubmission.plagiarismScore ?? null,
      aiContentScore: insertSubmission.aiContentScore ?? null,
      rubricScores: insertSubmission.rubricScores ?? null,
      instructorFeedback: insertSubmission.instructorFeedback ?? null,
      aiFeedback: insertSubmission.aiFeedback ?? null,
      submittedAt: insertSubmission.submittedAt ?? null,
      gradedAt: insertSubmission.gradedAt ?? null,
    };
    this.assignmentSubmissions.set(id, submission);
    return submission;
  }

  async updateAssignmentSubmission(id: string, data: Partial<AssignmentSubmission>): Promise<AssignmentSubmission | undefined> {
    const submission = this.assignmentSubmissions.get(id);
    if (!submission) return undefined;
    const updated = { ...submission, ...data };
    this.assignmentSubmissions.set(id, updated);
    return updated;
  }

  // Proctoring Violations
  async getProctoringViolations(submissionId: string): Promise<ProctoringViolation[]> {
    return Array.from(this.proctoringViolations.values())
      .filter(v => v.submissionId === submissionId);
  }

  async createProctoringViolation(insertViolation: InsertProctoringViolation): Promise<ProctoringViolation> {
    const id = randomUUID();
    const violation: ProctoringViolation = {
      ...insertViolation,
      id,
      description: insertViolation.description ?? null,
      severity: insertViolation.severity ?? "medium",
      screenshotUrl: insertViolation.screenshotUrl ?? null,
      reviewed: insertViolation.reviewed ?? false,
      reviewNote: insertViolation.reviewNote ?? null,
      timestamp: new Date(),
    };
    this.proctoringViolations.set(id, violation);
    return violation;
  }

  async updateProctoringViolation(id: string, data: Partial<ProctoringViolation>): Promise<ProctoringViolation | undefined> {
    const violation = this.proctoringViolations.get(id);
    if (!violation) return undefined;
    const updated = { ...violation, ...data };
    this.proctoringViolations.set(id, updated);
    return updated;
  }

  // Dashboard Stats
  async getDashboardStats(instructorId: string): Promise<{
    totalCourses: number;
    totalQuizzes: number;
    totalAssignments: number;
    totalStudents: number;
    pendingGrading: number;
    recentSubmissions: number;
  }> {
    const courses = await this.getCourses(instructorId);
    const courseIds = new Set(courses.map(c => c.id));
    
    const quizzes = (await this.getQuizzes()).filter(q => courseIds.has(q.courseId));
    const assignments = (await this.getAssignments()).filter(a => courseIds.has(a.courseId));
    
    let totalStudents = 0;
    for (const course of courses) {
      const enrollments = await this.getEnrollments(course.id);
      totalStudents += enrollments.length;
    }
    
    const quizSubmissions = Array.from(this.quizSubmissions.values())
      .filter(s => quizzes.some(q => q.id === s.quizId));
    const assignmentSubmissions = Array.from(this.assignmentSubmissions.values())
      .filter(s => assignments.some(a => a.id === s.assignmentId));
    
    const pendingGrading = [...quizSubmissions, ...assignmentSubmissions]
      .filter(s => s.status === "submitted").length;
    
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentSubmissions = [...quizSubmissions, ...assignmentSubmissions]
      .filter(s => s.submittedAt && new Date(s.submittedAt) > oneWeekAgo).length;

    return {
      totalCourses: courses.length,
      totalQuizzes: quizzes.length,
      totalAssignments: assignments.length,
      totalStudents,
      pendingGrading,
      recentSubmissions,
    };
  }
  
  // Public Quiz Submissions
  async getPublicQuizSubmissions(quizId: string): Promise<PublicQuizSubmission[]> {
    return Array.from(this.publicQuizSubmissions.values())
      .filter(s => s.quizId === quizId);
  }
  
  async getPublicQuizSubmission(id: string): Promise<PublicQuizSubmission | undefined> {
    return this.publicQuizSubmissions.get(id);
  }
  
  async createPublicQuizSubmission(insertSubmission: InsertPublicQuizSubmission): Promise<PublicQuizSubmission> {
    const id = randomUUID();
    const submission: PublicQuizSubmission = {
      ...insertSubmission,
      id,
      identificationData: insertSubmission.identificationData ?? null,
      answers: insertSubmission.answers ?? null,
      score: insertSubmission.score ?? null,
      totalPoints: insertSubmission.totalPoints ?? null,
      percentage: insertSubmission.percentage ?? null,
      status: insertSubmission.status ?? "in_progress",
      submittedAt: insertSubmission.submittedAt ?? null,
      ipAddress: insertSubmission.ipAddress ?? null,
      startedAt: new Date(),
    };
    this.publicQuizSubmissions.set(id, submission);
    return submission;
  }
  
  async updatePublicQuizSubmission(id: string, data: Partial<PublicQuizSubmission>): Promise<PublicQuizSubmission | undefined> {
    const submission = this.publicQuizSubmissions.get(id);
    if (!submission) return undefined;
    const updated = { ...submission, ...data };
    this.publicQuizSubmissions.set(id, updated);
    return updated;
  }
  
  // Quiz Public Link
  async getQuizByPublicToken(token: string): Promise<Quiz | undefined> {
    return Array.from(this.quizzes.values())
      .find(q => q.publicAccessToken === token && q.publicLinkEnabled);
  }
  
  async generateQuizPublicLink(quizId: string, permission: "view" | "attempt", requiredFields: string[]): Promise<Quiz | undefined> {
    const quiz = this.quizzes.get(quizId);
    if (!quiz) return undefined;
    
    const token = randomUUID().replace(/-/g, '').substring(0, 16);
    const updated: Quiz = {
      ...quiz,
      publicAccessToken: token,
      publicLinkPermission: permission,
      publicLinkEnabled: true,
      requiredIdentificationFields: requiredFields,
    };
    this.quizzes.set(quizId, updated);
    return updated;
  }
  
  // Chat Commands
  async getChatCommands(userId: string): Promise<ChatCommand[]> {
    return Array.from(this.chatCommands.values())
      .filter(c => c.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async getChatCommand(id: string): Promise<ChatCommand | undefined> {
    return this.chatCommands.get(id);
  }
  
  async createChatCommand(insertCommand: InsertChatCommand): Promise<ChatCommand> {
    const id = randomUUID();
    const command: ChatCommand = {
      ...insertCommand,
      id,
      conversationId: insertCommand.conversationId ?? null,
      intent: insertCommand.intent ?? null,
      parameters: insertCommand.parameters ?? null,
      status: insertCommand.status ?? "pending",
      result: insertCommand.result ?? null,
      completedAt: insertCommand.completedAt ?? null,
      createdAt: new Date(),
    };
    this.chatCommands.set(id, command);
    return command;
  }
  
  async updateChatCommand(id: string, data: Partial<ChatCommand>): Promise<ChatCommand | undefined> {
    const command = this.chatCommands.get(id);
    if (!command) return undefined;
    const updated = { ...command, ...data };
    this.chatCommands.set(id, updated);
    return updated;
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const id = randomUUID();
    const resetToken: PasswordResetToken = {
      id,
      userId,
      token,
      expiresAt,
      used: false,
      createdAt: new Date(),
    };
    this.passwordResetTokens.set(token, resetToken);
    return resetToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    return this.passwordResetTokens.get(token);
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    const resetToken = this.passwordResetTokens.get(token);
    if (resetToken) {
      this.passwordResetTokens.set(token, { ...resetToken, used: true });
    }
  }

  async getCourseAnalytics(courseId?: string, instructorId?: string): Promise<{
    overview: { totalStudents: number; averageScore: number; passRate: number; totalSubmissions: number };
    scoreDistribution: { range: string; count: number }[];
    performanceTrend: { date: string; average: number }[];
    topPerformers: { studentId: string; name: string; score: number; quizCount: number }[];
    lowPerformers: { studentId: string; name: string; score: number; quizCount: number }[];
    quizStats: { quizId: string; name: string; avgScore: number; submissions: number; passRate: number }[];
    violationStats: { type: string; count: number }[];
  }> {
    // Resolve courses in scope
    let courses: Course[] = [];
    if (courseId) {
      const c = this.courses.get(courseId);
      if (c) courses = [c];
    } else if (instructorId) {
      courses = Array.from(this.courses.values()).filter(c => c.instructorId === instructorId);
    } else {
      courses = Array.from(this.courses.values());
    }

    const courseIds = new Set(courses.map(c => c.id));
    const allQuizzes = Array.from(this.quizzes.values()).filter(q => courseIds.has(q.courseId));
    const quizIds = new Set(allQuizzes.map(q => q.id));

    // All graded quiz submissions in scope
    const allSubmissions = Array.from(this.quizSubmissions.values())
      .filter(s => quizIds.has(s.quizId) && (s.status === "graded" || s.status === "submitted") && s.percentage !== null);

    const totalSubmissions = allSubmissions.length;
    const averageScore = totalSubmissions > 0
      ? Math.round(allSubmissions.reduce((sum, s) => sum + (s.percentage ?? 0), 0) / totalSubmissions)
      : 0;

    // Unique students across enrollments
    const uniqueStudentIds = new Set<string>();
    for (const c of courses) {
      const enrolls = Array.from(this.enrollments.values()).filter(e => e.courseId === c.id);
      enrolls.forEach(e => uniqueStudentIds.add(e.studentId));
    }
    const totalStudents = uniqueStudentIds.size;

    // Pass rate
    const passingSubmissions = allSubmissions.filter(s => {
      const quiz = this.quizzes.get(s.quizId);
      const passingScore = quiz?.passingScore ?? 60;
      return (s.percentage ?? 0) >= passingScore;
    });
    const passRate = totalSubmissions > 0 ? Math.round((passingSubmissions.length / totalSubmissions) * 100) : 0;

    // Score distribution
    const scoreDistribution = [
      { range: "0-20", count: 0 },
      { range: "21-40", count: 0 },
      { range: "41-60", count: 0 },
      { range: "61-80", count: 0 },
      { range: "81-100", count: 0 },
    ];
    for (const s of allSubmissions) {
      const pct = s.percentage ?? 0;
      if (pct <= 20) scoreDistribution[0].count++;
      else if (pct <= 40) scoreDistribution[1].count++;
      else if (pct <= 60) scoreDistribution[2].count++;
      else if (pct <= 80) scoreDistribution[3].count++;
      else scoreDistribution[4].count++;
    }

    // Performance trend (weekly averages)
    const sorted = [...allSubmissions].filter(s => s.submittedAt).sort((a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime());
    const weekMap = new Map<string, number[]>();
    for (const s of sorted) {
      if (!s.submittedAt) continue;
      const d = new Date(s.submittedAt);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = `${weekStart.getFullYear()}-W${weekStart.getMonth() + 1}-${weekStart.getDate()}`;
      if (!weekMap.has(key)) weekMap.set(key, []);
      weekMap.get(key)!.push(s.percentage ?? 0);
    }
    const performanceTrend = Array.from(weekMap.entries()).map(([date, scores]) => ({
      date,
      average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }));

    // Top/low performers
    const studentScoreMap = new Map<string, number[]>();
    for (const s of allSubmissions) {
      if (!studentScoreMap.has(s.studentId)) studentScoreMap.set(s.studentId, []);
      studentScoreMap.get(s.studentId)!.push(s.percentage ?? 0);
    }
    const studentAverages = await Promise.all(
      Array.from(studentScoreMap.entries()).map(async ([studentId, scores]) => {
        const user = this.users.get(studentId);
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        return { studentId, name: user?.name ?? "Unknown", score: avg, quizCount: scores.length };
      })
    );
    studentAverages.sort((a, b) => b.score - a.score);
    const topPerformers = studentAverages.slice(0, 5);
    const lowPerformers = [...studentAverages].reverse().slice(0, 5);

    // Quiz stats
    const quizStats = await Promise.all(
      allQuizzes.map(async (quiz) => {
        const subs = allSubmissions.filter(s => s.quizId === quiz.id);
        const avgScore = subs.length > 0 ? Math.round(subs.reduce((sum, s) => sum + (s.percentage ?? 0), 0) / subs.length) : 0;
        const passing = subs.filter(s => (s.percentage ?? 0) >= (quiz.passingScore ?? 60));
        const passRate = subs.length > 0 ? Math.round((passing.length / subs.length) * 100) : 0;
        return { quizId: quiz.id, name: quiz.title, avgScore, submissions: subs.length, passRate };
      })
    );

    // Violation stats
    const allViolations = Array.from(this.proctoringViolations.values()).filter(v => {
      const sub = this.quizSubmissions.get(v.submissionId);
      return sub && quizIds.has(sub.quizId);
    });
    const violationTypeMap = new Map<string, number>();
    for (const v of allViolations) {
      violationTypeMap.set(v.type, (violationTypeMap.get(v.type) ?? 0) + 1);
    }
    const violationStats = Array.from(violationTypeMap.entries()).map(([type, count]) => ({ type, count }));

    return {
      overview: { totalStudents, averageScore, passRate, totalSubmissions },
      scoreDistribution,
      performanceTrend,
      topPerformers,
      lowPerformers,
      quizStats,
      violationStats,
    };
  }

  async getGradebook(courseId: string): Promise<{
    course: Course;
    quizzes: Quiz[];
    assignments: Assignment[];
    students: Array<{
      student: User;
      quizResults: Array<{ quizId: string; quizTitle: string; score: number | null; percentage: number | null; status: string }>;
      assignmentResults: Array<{ assignmentId: string; assignmentTitle: string; score: number | null; maxScore: number; status: string }>;
      overallAverage: number | null;
    }>;
    quizSummary: Array<{ quizId: string; title: string; best: number | null; worst: number | null; average: number | null; count: number }>;
    assignmentSummary: Array<{ assignmentId: string; title: string; best: number | null; worst: number | null; average: number | null; count: number }>;
  }> {
    const course = this.courses.get(courseId);
    if (!course) throw new Error("Course not found");

    const courseQuizzes = Array.from(this.quizzes.values()).filter(q => q.courseId === courseId);
    const courseAssignments = Array.from(this.assignments.values()).filter(a => a.courseId === courseId);
    const courseEnrollments = Array.from(this.enrollments.values()).filter(e => e.courseId === courseId);

    const students = await Promise.all(
      courseEnrollments.map(async (enrollment) => {
        const student = this.users.get(enrollment.studentId);
        if (!student) return null;

        const quizResults = courseQuizzes.map(quiz => {
          const sub = Array.from(this.quizSubmissions.values())
            .find(s => s.quizId === quiz.id && s.studentId === enrollment.studentId);
          return {
            quizId: quiz.id,
            quizTitle: quiz.title,
            score: sub?.score ?? null,
            percentage: sub?.percentage ?? null,
            status: sub?.status ?? "not_attempted",
          };
        });

        const assignmentResults = courseAssignments.map(assignment => {
          const sub = Array.from(this.assignmentSubmissions.values())
            .find(s => s.assignmentId === assignment.id && s.studentId === enrollment.studentId);
          return {
            assignmentId: assignment.id,
            assignmentTitle: assignment.title,
            score: sub?.score ?? null,
            maxScore: assignment.maxScore,
            status: sub?.status ?? "not_submitted",
          };
        });

        const quizPercentages = quizResults.filter(r => r.percentage !== null).map(r => r.percentage as number);
        const assignmentPercentages = assignmentResults
          .filter(r => r.score !== null && r.maxScore > 0)
          .map(r => Math.round(((r.score as number) / r.maxScore) * 100));
        const allPercentages = [...quizPercentages, ...assignmentPercentages];
        const overallAverage = allPercentages.length > 0
          ? Math.round(allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length)
          : null;

        return { student, quizResults, assignmentResults, overallAverage };
      })
    );

    const filteredStudents = students.filter(Boolean) as Array<{
      student: User;
      quizResults: Array<{ quizId: string; quizTitle: string; score: number | null; percentage: number | null; status: string }>;
      assignmentResults: Array<{ assignmentId: string; assignmentTitle: string; score: number | null; maxScore: number; status: string }>;
      overallAverage: number | null;
    }>;

    // Quiz summary: best/worst/average per quiz
    const quizSummary = courseQuizzes.map(quiz => {
      const subs = Array.from(this.quizSubmissions.values())
        .filter(s => s.quizId === quiz.id && s.percentage !== null);
      const percentages = subs.map(s => s.percentage as number);
      return {
        quizId: quiz.id,
        title: quiz.title,
        best: percentages.length > 0 ? Math.max(...percentages) : null,
        worst: percentages.length > 0 ? Math.min(...percentages) : null,
        average: percentages.length > 0 ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : null,
        count: percentages.length,
      };
    });

    // Assignment summary: best/worst/average per assignment
    const assignmentSummary = courseAssignments.map(assignment => {
      const subs = Array.from(this.assignmentSubmissions.values())
        .filter(s => s.assignmentId === assignment.id && s.score !== null && assignment.maxScore > 0);
      const percentages = subs.map(s => Math.round(((s.score as number) / assignment.maxScore) * 100));
      return {
        assignmentId: assignment.id,
        title: assignment.title,
        best: percentages.length > 0 ? Math.max(...percentages) : null,
        worst: percentages.length > 0 ? Math.min(...percentages) : null,
        average: percentages.length > 0 ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : null,
        count: percentages.length,
      };
    });

    return { course, quizzes: courseQuizzes, assignments: courseAssignments, students: filteredStudents, quizSummary, assignmentSummary };
  }

  async getStudentPerformance(studentId: string): Promise<{
    student: User;
    enrolledCourses: Course[];
    quizSubmissions: Array<QuizSubmission & { quizTitle: string; courseId: string; courseName: string }>;
    assignmentSubmissions: Array<AssignmentSubmission & { assignmentTitle: string; courseId: string; courseName: string }>;
    proctoringViolations: ProctoringViolation[];
    stats: {
      totalQuizzesTaken: number;
      averageQuizScore: number;
      bestQuizScore: number;
      worstQuizScore: number;
      totalAssignmentsSubmitted: number;
      averageAssignmentScore: number;
      totalViolations: number;
    };
  }> {
    const student = this.users.get(studentId);
    if (!student) throw new Error("Student not found");

    const enrolledCourseIds = Array.from(this.enrollments.values())
      .filter(e => e.studentId === studentId)
      .map(e => e.courseId);
    const enrolledCourses = enrolledCourseIds.map(id => this.courses.get(id)).filter(Boolean) as Course[];

    // Quiz submissions with quiz and course info
    const quizSubs = Array.from(this.quizSubmissions.values())
      .filter(s => s.studentId === studentId && s.status !== "in_progress");
    const enrichedQuizSubs = quizSubs.map(s => {
      const quiz = this.quizzes.get(s.quizId);
      const course = quiz ? this.courses.get(quiz.courseId) : undefined;
      return {
        ...s,
        quizTitle: quiz?.title ?? "Unknown Quiz",
        courseId: course?.id ?? "",
        courseName: course?.name ?? "Unknown Course",
      };
    }).sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime());

    // Assignment submissions with assignment and course info
    const assignmentSubs = Array.from(this.assignmentSubmissions.values())
      .filter(s => s.studentId === studentId);
    const enrichedAssignmentSubs = assignmentSubs.map(s => {
      const assignment = this.assignments.get(s.assignmentId);
      const course = assignment ? this.courses.get(assignment.courseId) : undefined;
      return {
        ...s,
        assignmentTitle: assignment?.title ?? "Unknown Assignment",
        courseId: course?.id ?? "",
        courseName: course?.name ?? "Unknown Course",
      };
    }).sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime());

    // Proctoring violations for this student's submissions
    const studentSubmissionIds = new Set(quizSubs.map(s => s.id));
    const violations = Array.from(this.proctoringViolations.values())
      .filter(v => studentSubmissionIds.has(v.submissionId));

    // Stats
    const gradedQuizSubs = quizSubs.filter(s => s.percentage !== null);
    const quizPercentages = gradedQuizSubs.map(s => s.percentage as number);
    const averageQuizScore = quizPercentages.length > 0
      ? Math.round(quizPercentages.reduce((a, b) => a + b, 0) / quizPercentages.length) : 0;
    const bestQuizScore = quizPercentages.length > 0 ? Math.max(...quizPercentages) : 0;
    const worstQuizScore = quizPercentages.length > 0 ? Math.min(...quizPercentages) : 0;

    const gradedAssignmentSubs = assignmentSubs.filter(s => s.score !== null);
    const assignmentScores = gradedAssignmentSubs.map(s => {
      const assignment = this.assignments.get(s.assignmentId);
      const maxScore = assignment?.maxScore ?? 100;
      return maxScore > 0 ? Math.round(((s.score as number) / maxScore) * 100) : 0;
    });
    const averageAssignmentScore = assignmentScores.length > 0
      ? Math.round(assignmentScores.reduce((a, b) => a + b, 0) / assignmentScores.length) : 0;

    return {
      student,
      enrolledCourses,
      quizSubmissions: enrichedQuizSubs,
      assignmentSubmissions: enrichedAssignmentSubs,
      proctoringViolations: violations,
      stats: {
        totalQuizzesTaken: quizSubs.length,
        averageQuizScore,
        bestQuizScore,
        worstQuizScore,
        totalAssignmentsSubmitted: assignmentSubs.length,
        averageAssignmentScore,
        totalViolations: violations.length,
      },
    };
  }
}

export const storage = new MemStorage();
