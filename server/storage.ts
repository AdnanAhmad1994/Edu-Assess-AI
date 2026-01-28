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
  type ChatCommand, type InsertChatCommand,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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
  
  // Stats
  getDashboardStats(instructorId: string): Promise<{
    totalCourses: number;
    totalQuizzes: number;
    totalAssignments: number;
    totalStudents: number;
    pendingGrading: number;
    recentSubmissions: number;
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

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
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
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
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
      timestamp: new Date(),
    };
    this.proctoringViolations.set(id, violation);
    return violation;
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
}

export const storage = new MemStorage();
