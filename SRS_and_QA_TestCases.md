# EduAssess AI — Software Requirements Specification (SRS) & QA Test Cases

**Document Version:** 1.0
**Platform:** EduAssess AI — Intelligent Educational Assessment Platform
**Stack:** React (TypeScript), Express.js, PostgreSQL (Drizzle ORM), Multi-provider AI (Gemini, OpenAI, OpenRouter, Grok, Kimi, Anthropic, Custom)
**Prepared By:** Requirements Engineering & QA Division
**Date:** 2026-02-20

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [System Constraints](#3-system-constraints)
4. [Functional Requirements](#4-functional-requirements)
   - 4.1 Authentication & Account Management
   - 4.2 Course Management
   - 4.3 Quiz Management
   - 4.4 Assignment Management
   - 4.5 AI Question & Content Generation
   - 4.6 Proctoring & Integrity
   - 4.7 Grading & Gradebook
   - 4.8 Analytics
   - 4.9 AI Agentic Chatbot (Co-Pilot)
   - 4.10 Settings & AI Provider Configuration
   - 4.11 Public Quiz Links
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Use Cases](#6-use-cases)
7. [QA Test Cases](#7-qa-test-cases)

---

## 1. Introduction

### 1.1 Purpose

This document defines the complete Software Requirements Specification (SRS) for EduAssess AI, an EdTech platform enabling instructors and administrators to create, manage, proctor, and grade quizzes and assignments, powered by a configurable multi-provider AI layer. It also contains comprehensive QA test cases derived from every functional requirement.

### 1.2 Scope

EduAssess AI is a full-stack web application covering:
- User authentication with password and pattern-lock options
- Course, lecture, quiz, and assignment lifecycle management
- AI-powered question generation from text, PDF, and image files
- Browser-based webcam proctoring with AI frame analysis
- Automated quiz grading and AI-assisted assignment grading
- Plagiarism and AI-content detection for assignments
- A gradebook with CSV export
- An agentic AI chatbot (co-pilot) that performs real platform actions in natural language
- A configurable AI provider layer supporting seven providers

### 1.3 Definitions

| Term | Definition |
|------|-----------|
| Instructor | A user who creates and manages courses, quizzes, and assignments |
| Student | A user who takes quizzes and submits assignments |
| Admin | Super-user with full platform access including user management |
| Proctoring | Real-time webcam-based monitoring of quiz sessions for academic integrity |
| Co-Pilot | The agentic AI chatbot that executes platform actions via natural language |
| Public Link | A shareable URL allowing unauthenticated access to a quiz |
| Violation Threshold | Maximum number of proctoring violations before auto-submission |
| AI Provider | An external LLM API (Gemini, OpenAI, etc.) used for AI features |

---

## 2. User Roles & Permissions

| Capability | Student | Instructor | Admin |
|-----------|---------|-----------|-------|
| Register account (self) | Yes | Yes | N/A (seeded) |
| Login (password + pattern) | Yes | Yes | Yes |
| View enrolled course content | Yes | No | Yes |
| Take published quizzes | Yes | No | No |
| Submit assignments | Yes | No | No |
| View own grades and results | Yes | No | No |
| Create / edit courses | No | Yes | Yes |
| Enroll students | No | Yes | Yes |
| Create / publish quizzes | No | Yes | Yes |
| Create / publish assignments | No | Yes | Yes |
| Generate AI questions | No | Yes | Yes |
| Grade assignments (manual + AI) | No | Yes | Yes |
| Review proctoring violations | No | Yes | Yes |
| View analytics & gradebook | No | Yes | Yes |
| Export gradebook CSV | No | Yes | Yes |
| Generate public quiz links | No | Yes | Yes |
| Use AI Co-Pilot chatbot | No | Yes | Yes |
| Configure AI provider keys | No | Yes | Yes |
| Manage all users (CRUD) | No | No | Yes |
| View all courses platform-wide | No | No | Yes |
| Delete any content | No | Own only | Yes |
| Access /api/users endpoint | No | No | Yes |

---

## 3. System Constraints

| ID | Constraint |
|----|-----------|
| SC-01 | The platform must run on Node.js 18+ with Express.js as the HTTP server. |
| SC-02 | The database must be PostgreSQL with Drizzle ORM schema defined in `shared/schema.ts`. |
| SC-03 | Session management must use `express-session` with httpOnly, secure cookies in production. |
| SC-04 | Passwords must be hashed with bcrypt (minimum cost factor 10) before storage. |
| SC-05 | No plain-text API keys may be returned to the client; keys are masked or omitted. |
| SC-06 | File uploads for quiz attachments and proctoring screenshots use Object Storage (GCS-compatible). |
| SC-07 | The AI Co-Pilot is available only to Instructor and Admin roles; students are excluded. |
| SC-08 | A default admin account (username: `admin`) is seeded on first boot; default password must be changed. |
| SC-09 | Course imports from CSV/XLSX are limited to 500 rows and 5 MB per file. |
| SC-10 | The platform must support dark mode and light mode via a ThemeProvider toggle. |
| SC-11 | All AI generation uses the user's configured active provider; falls back to platform Gemini key if none set. |
| SC-12 | The frontend uses React with Wouter for routing and TanStack Query for server state. |
| SC-13 | Session cookie max age is 24 hours; sessions are server-side. |
| SC-14 | Proctoring screenshot uploads occur only when violations are detected to reduce storage costs. |
| SC-15 | Public quiz submissions store IP address for audit; they are associated by identificationData (name, email, etc.) not by user account. |

---

## 4. Functional Requirements

---

### 4.1 Module: Authentication & Account Management

---

**FR-01**

**Title:** User Registration
**Description:** Any visitor may register a new account by providing name, email, username (min 3 chars), password (min 6 chars), confirm-password, and a role (student or instructor). Duplicate usernames and emails are rejected. Passwords are hashed before storage. On success, the user is logged in and redirected to the dashboard.
**Priority:** Critical
**Acceptance Criteria:**
- Registration succeeds with all valid, unique fields.
- A 400 error is returned when username already exists.
- A 400 error is returned when email already exists.
- Passwords shorter than 6 characters are rejected client-side and server-side.
- Name shorter than 2 characters is rejected.
- Username shorter than 3 characters is rejected.
- Mismatched passwords are caught before submission.
- Successful registration creates a session and returns sanitized user object (no password field).
- Role must be one of `student` or `instructor`; `admin` is not selectable at registration.

---

**FR-02**

**Title:** Username/Password Login
**Description:** Registered users log in with their username and password. The server compares the bcrypt hash. On success, a session cookie is set. On failure, a generic "Invalid credentials" message is returned (no user-enumeration).
**Priority:** Critical
**Acceptance Criteria:**
- Correct credentials create a session and return sanitized user object.
- Wrong password returns HTTP 401 with "Invalid credentials".
- Non-existent username returns HTTP 401 with "Invalid credentials" (same message for both cases).
- Session cookie is httpOnly and secure in production.
- Authenticated users visiting `/login` are redirected to `/dashboard`.

---

**FR-03**

**Title:** Pattern Lock Login
**Description:** Users who have set a pattern lock can authenticate using username + a 9-dot grid pattern (minimum 4 unique dots, numbered 0–8). The pattern sequence is bcrypt-hashed on the server.
**Priority:** High
**Acceptance Criteria:**
- Pattern with fewer than 4 dots is rejected with "Pattern must connect at least 4 dots".
- Pattern with duplicate dot numbers is rejected.
- Correct pattern + username creates a session.
- Wrong pattern returns 401 "Invalid credentials".
- Pattern login works for all roles.

---

**FR-04**

**Title:** Pattern Lock Setup & Removal
**Description:** Any authenticated user can set or remove a pattern lock via Settings. Setting requires a valid pattern (min 4 unique dots, 0–8). Removal deletes the stored hash.
**Priority:** Medium
**Acceptance Criteria:**
- Valid pattern is hashed and stored; success response includes `enabled: true`.
- Invalid patterns (length < 4, duplicates, out-of-range) return 400.
- DELETE `/api/settings/pattern` sets `patternHash` to null and returns `enabled: false`.
- Pattern status (enabled/disabled) is retrievable via GET `/api/settings/pattern`.

---

**FR-05**

**Title:** Forgot Password (Email Reset)
**Description:** Users who forget their password enter their email address. If the email matches an account, a password reset link (valid 1 hour, single-use) is sent via email. The response is identical regardless of whether the email exists (prevents enumeration).
**Priority:** High
**Acceptance Criteria:**
- A cryptographically random 32-byte hex token is generated and stored with expiry timestamp.
- Reset email is sent containing the full reset URL.
- Token expires after 1 hour.
- Token can only be used once; subsequent use returns "already been used".
- Expired token returns "expired" error.
- New password must be at least 6 characters.
- Successful reset hashes and stores new password; token is marked used.

---

**FR-06**

**Title:** Forgot Username (Email Reminder)
**Description:** Users enter their registered email to receive a username reminder email. Response is identical regardless of email validity.
**Priority:** Medium
**Acceptance Criteria:**
- Registered email triggers a username reminder email.
- Unknown email returns same 200 response with generic message.

---

**FR-07**

**Title:** Logout
**Description:** Authenticated users can log out. The server destroys the session and clears the session cookie.
**Priority:** Critical
**Acceptance Criteria:**
- POST `/api/auth/logout` destroys server session.
- `connect.sid` cookie is cleared.
- Subsequent requests to protected endpoints return 401.

---

**FR-08**

**Title:** Admin User Management
**Description:** Admins can list all users (optionally filtered by role), create users with any role, update a user's name/email/role/password, and delete users. An admin cannot delete their own account.
**Priority:** High
**Acceptance Criteria:**
- Non-admin access to `/api/users` returns 403.
- Admin can create users with role `admin`, `instructor`, or `student`.
- Duplicate username/email on admin-create returns 400.
- Admin can change any user's role.
- Admin deleting own account returns 400 "Cannot delete your own account".
- Passwords set by admin are bcrypt-hashed before storage.
- Deleted user's sessions are invalid immediately (next request returns 401).

---

### 4.2 Module: Course Management

---

**FR-09**

**Title:** Course CRUD
**Description:** Instructors and admins can create, read, update, and delete courses. Each course has name, code, description, and semester. Students see only enrolled courses. Admins see all courses platform-wide. Instructors see only their own courses.
**Priority:** Critical
**Acceptance Criteria:**
- Course creation requires `name`, `code`, `semester` (validated by Zod schema).
- Instructor's `id` is automatically set as `instructorId`.
- GET `/api/courses` returns only enrolled courses for students, own courses for instructors, all courses for admins.
- PUT `/api/courses/:id` updates allowed fields.
- DELETE `/api/courses/:id` cascades deletion to all lectures, quizzes, and assignments.
- Students cannot create/update/delete courses (403).

---

**FR-10**

**Title:** Course Import (CSV/XLSX)
**Description:** Instructors can bulk-import courses from a CSV or XLSX file. File must contain `name`, `code`, `semester` columns. Maximum 500 rows, 5 MB file size. Invalid rows are skipped with error messages returned in the response.
**Priority:** Medium
**Acceptance Criteria:**
- Valid file creates all parseable courses in a single request.
- File exceeding 5 MB returns 400.
- File with more than 500 rows returns 400.
- Unsupported file types (e.g., `.docx`, `.txt`) return 400.
- Partial success response reports `imported`, `total`, `valid`, and `errors` fields.
- Rows missing required columns are listed in `errors`.

---

**FR-11**

**Title:** Student Enrollment
**Description:** Instructors enroll students in a course by studentId or studentEmail. If already enrolled, returns 200 (idempotent). Students can be unenrolled by instructors. Enrolled students immediately see the course and its published content.
**Priority:** High
**Acceptance Criteria:**
- Enrollment by studentId succeeds if the student exists.
- Enrollment by studentEmail looks up the user by email.
- Re-enrollment of an already-enrolled student returns 200 "Already enrolled".
- Non-existent email returns 404.
- Missing both studentId and studentEmail returns 400.
- GET `/api/courses/:id/enrollments` returns all enrollments for instructors.
- Students cannot call enrollment endpoints (403).

---

### 4.3 Module: Quiz Management

---

**FR-12**

**Title:** Quiz Creation (Manual & AI-Assisted)
**Description:** Instructors create quizzes with title, description, instructions, course assignment, time limit, passing score, question randomization, option randomization, proctoring toggle, violation threshold, and status (draft/published/closed). Questions can be added manually or AI-generated at creation time. Attachments (PDF, images) can be associated.
**Priority:** Critical
**Acceptance Criteria:**
- Quiz created with minimum fields (title, courseId) succeeds.
- `status` defaults to `draft`.
- `randomizeQuestions` and `randomizeOptions` default to `true`.
- `proctored` defaults to `false`.
- `violationThreshold` defaults to 5.
- Questions passed in `questions[]` array are created and linked via `quiz_questions` junction table.
- AI-generated questions have `aiGenerated: true` in the database.
- Quiz is retrievable immediately after creation.
- Students cannot create quizzes (403).

---

**FR-13**

**Title:** Quiz Publishing & Status Lifecycle
**Description:** Quizzes follow a draft → published → closed lifecycle. Only published quizzes are visible to students. Instructors can publish, unpublish (back to draft), close, or archive quizzes via API or AI Co-Pilot. Start/end date windows can be set.
**Priority:** Critical
**Acceptance Criteria:**
- PATCH `/api/quizzes/:id/publish` sets status to `published`.
- Students see only `published` quizzes in their course quizzes list.
- Closed/draft quizzes are not accessible to students.
- Start and end date fields control availability window when set.

---

**FR-14**

**Title:** Quiz Taking (Student Flow)
**Description:** Authenticated students access published quizzes via `/quiz/:id/take`. The server returns questions with correct answers stripped. A submission record is created on start. The student answers questions one by one (navigation supported). A countdown timer is displayed when a time limit is set. Submitting finalizes the attempt.
**Priority:** Critical
**Acceptance Criteria:**
- GET `/api/quiz/:id/take` returns quiz metadata and questions without `correctAnswer` or `explanation` fields.
- Questions are randomized server-side when `randomizeQuestions` is true.
- POST `/api/quiz/:id/start` creates a `quiz_submissions` record with `status: in_progress`.
- POST `/api/quiz/:id/submit` grades the submission, sets `status: graded`, records `score`, `totalPoints`, `percentage`, `submittedAt`, `gradedAt`.
- Timer expires → auto-submit triggered (client-side enforcement).
- Student cannot take same quiz twice if a graded submission exists (handled by UI state).
- `aiFeedback` is generated and stored on quiz grading.

---

**FR-15**

**Title:** Quiz Results Display
**Description:** After submission, students are redirected to `/quiz/:id/results/:submissionId` showing score, percentage, pass/fail status, per-question breakdown (correct/incorrect), and AI-generated feedback.
**Priority:** High
**Acceptance Criteria:**
- Results page fetches submission data with per-question grading.
- Score, totalPoints, and percentage are accurately computed.
- Pass/fail status derived from `passingScore` threshold.
- AI feedback is displayed when available.
- Students can only view their own results.

---

**FR-16**

**Title:** Quiz Edit & Question Management
**Description:** Instructors can edit quiz metadata and add/remove/reorder questions in the quiz builder. The quiz builder supports manual question entry and AI generation from text or uploaded files.
**Priority:** High
**Acceptance Criteria:**
- PUT `/api/quizzes/:id` updates quiz metadata.
- Questions can be added to existing quizzes.
- Questions can be removed from quizzes (removes junction record, not base question).
- Reordering is persisted via `orderIndex` field.
- Question types supported: `mcq`, `true_false`, `short_answer`, `fill_blank`, `essay`, `matching`.

---

**FR-17**

**Title:** Quiz Deletion
**Description:** Instructors can delete quizzes they own. Admins can delete any quiz. Deletion cascades to quiz questions and submissions.
**Priority:** Medium
**Acceptance Criteria:**
- DELETE `/api/quizzes/:id` succeeds for the quiz owner.
- Non-owner instructor cannot delete another instructor's quiz.
- 404 returned for non-existent quiz.

---

### 4.4 Module: Assignment Management

---

**FR-18**

**Title:** Assignment Creation
**Description:** Instructors create assignments with title, description, instructions, rubric (array of criterion/maxPoints/description objects), max score, due date, late submission policy (allow/deny + penalty percent), and status.
**Priority:** Critical
**Acceptance Criteria:**
- Assignment created with minimum required fields (title, courseId, maxScore) succeeds.
- `status` defaults to `draft`.
- `allowLateSubmission` defaults to `false`.
- `latePenaltyPercent` defaults to 10.
- Rubric items stored as JSONB; each item has `criterion`, `maxPoints`, `description`.
- Students cannot create assignments (403).

---

**FR-19**

**Title:** Assignment Submission (Student)
**Description:** Students submit assignments via text content and/or file upload. Only published assignments in enrolled courses are accessible. Submission stores content, fileUrl, and timestamps.
**Priority:** Critical
**Acceptance Criteria:**
- Student can submit text and/or a file attachment.
- `submittedAt` timestamp is recorded on submission.
- Late submissions beyond `dueDate` are accepted only if `allowLateSubmission` is true; otherwise rejected.
- Student can resubmit (overwrites previous in-progress submission).
- Students cannot submit to assignments outside their enrolled courses.

---

**FR-20**

**Title:** Assignment Grading (Instructor Manual + AI)
**Description:** Instructors grade assignment submissions via a grading page that shows submission content, rubric, AI-detected plagiarism/AI score, and a feedback form. Instructors can fill per-rubric scores and overall feedback. AI grading automatically scores each rubric criterion and generates feedback. AI content detection returns a percentage probability of AI-written content.
**Priority:** Critical
**Acceptance Criteria:**
- Instructor sees student name, submission content, and file attachment on grading page.
- Rubric scores can be entered per criterion with a score and feedback text.
- Total score is calculated as sum of rubric scores.
- Manual instructor feedback field is available.
- "AI Grade" button triggers AI grading which populates rubric scores and generates `aiFeedback`.
- AI content detection score (0–100) is stored as `aiContentScore`.
- `plagiarismScore` field is populated by comparison analysis.
- Grading sets `status: graded` and records `gradedAt` timestamp.
- Students cannot access grading endpoints (403).

---

**FR-21**

**Title:** Assignment Submissions List
**Description:** Instructors view all submissions for a given assignment, including student names, submission status, scores, and plagiarism/AI scores. Bulk AI grading can be triggered from this list.
**Priority:** High
**Acceptance Criteria:**
- GET `/api/assignments/:id/submissions` returns all submissions for the assignment.
- Each submission includes student name, status, score, aiContentScore, plagiarismScore.
- "Bulk AI Grade" triggers AI grading on all ungraded submissions.
- Submissions are sorted by submission date.

---

### 4.5 Module: AI Question & Content Generation

---

**FR-22**

**Title:** AI Question Generation from Text
**Description:** Instructors provide a topic or text content along with desired question count (default 5) and difficulty level (easy/medium/hard/mixed). The AI generates questions in MCQ, true/false, short answer, and fill-in-the-blank formats and returns them as structured JSON.
**Priority:** Critical
**Acceptance Criteria:**
- POST `/api/ai/generate-questions` requires `content` and `courseId`.
- Response includes a `questions` array with `type`, `text`, `options`, `correctAnswer`, `difficulty`, `points`.
- MCQ questions have exactly 4 `options`.
- True/false questions have options `["True", "False"]`.
- Short answer and fill-blank have empty `options` array.
- `difficulty` is one of `easy`, `medium`, `hard`.
- `points` is an integer 1–3.
- Questions marked with `aiGenerated: true` when stored.
- If AI provider is unavailable, a descriptive error is returned (not a 500 with stack trace).

---

**FR-23**

**Title:** AI Question Generation from File (PDF/Image)
**Description:** Instructors upload a PDF or image file; the AI analyzes the file content and generates questions. For images, multimodal content is passed to the AI. For PDFs and other documents, the file is fetched and encoded as base64.
**Priority:** High
**Acceptance Criteria:**
- POST `/api/ai/generate-questions-from-file` requires `fileUrl`, `fileType`, `numQuestions`, `difficulty`.
- Image files are sent as multimodal image_url content to the AI.
- Non-image files are sent as text (base64-encoded content passed via prompt).
- Response structure matches FR-22 format.
- Questions generated are tagged `aiGenerated: true` when saved.
- Unsupported file types produce a user-friendly error.

---

**FR-24**

**Title:** Lecture AI Summarization
**Description:** Instructors can trigger AI summarization of a lecture, which generates a 2–3 paragraph summary and 5–7 key bullet points from the lecture title and description. Results are stored on the lecture record.
**Priority:** Medium
**Acceptance Criteria:**
- POST `/api/lectures/:id/generate-summary` fetches the lecture and sends title + description to AI.
- AI response is parsed for `summary` and `keyPoints` fields.
- Summary and keyPoints are updated on the lecture record.
- Response includes `success: true` and the generated content.
- Malformed AI response (no JSON found) returns 500 with descriptive error.

---

**FR-25**

**Title:** AI Content Detection (Assignment Submissions)
**Description:** When grading an assignment, the AI analyzes submitted text for probability of being AI-written. The result (0–100 integer) is stored as `aiContentScore` on the submission.
**Priority:** High
**Acceptance Criteria:**
- AI content score of 0 indicates human-written; 100 indicates AI-written.
- Score is displayed on the grading page.
- Score does not automatically affect the grade; instructor decides.

---

**FR-26**

**Title:** Plagiarism Detection (Assignment Submissions)
**Description:** The system compares a student's assignment submission against other submissions for the same assignment to detect textual similarity. A similarity score (0–100) is stored as `plagiarismScore`.
**Priority:** High
**Acceptance Criteria:**
- `plagiarismScore` is populated during AI grading.
- Score is visible on the grading page and submissions list.
- High plagiarism score (e.g., > 70) is visually flagged in the UI.

---

### 4.6 Module: Proctoring & Academic Integrity

---

**FR-27**

**Title:** Proctored Quiz Session
**Description:** When a quiz has `proctored: true`, students must grant webcam access before taking the quiz. The webcam feed is analyzed by AI at regular intervals. Detected violations are logged. Tab switching and copy-paste are also detected.
**Priority:** Critical
**Acceptance Criteria:**
- Quiz page detects if `proctored` is true and requests webcam permission on load.
- If webcam permission is denied, student cannot proceed with the proctored quiz (graceful error shown).
- Camera feed is displayed in a small overlay during the quiz.
- AI frame analysis is called at regular intervals (implementation: every N seconds).
- Detected violation types: `tab_switch`, `copy_paste`, `multiple_faces`, `no_face`, `phone_detected`, `unauthorized_person`, `looking_away`, `suspicious_behavior`.
- Each violation is POSTed to `/api/proctoring/violation` and stored.
- Violation count is displayed to the student in real time.
- When violations reach `violationThreshold`, the quiz is auto-submitted and the student is notified.
- Non-proctored quizzes do not request camera access.

---

**FR-28**

**Title:** AI Webcam Frame Analysis
**Description:** The server receives a base64-encoded webcam frame and sends it to the configured AI provider (multimodal). The AI returns a JSON array of violations. Screenshots are uploaded to object storage only when violations are detected.
**Priority:** Critical
**Acceptance Criteria:**
- POST `/api/proctoring/analyze-frame` accepts `submissionId` and `imageData`.
- AI prompt requests detection of: no face, multiple faces, phone, unauthorized person, looking away, suspicious behavior.
- Response is a `violations` array with `type` and `description` per violation.
- Empty array returned when no violations detected.
- If object storage is unavailable, screenshot upload fails silently (non-critical); violation is still logged.
- `screenshotUrl` is stored on the violation record when upload succeeds.

---

**FR-29**

**Title:** Proctoring Violation Review
**Description:** Instructors review proctoring violations for a specific submission via `/quiz/:id/submissions/:submissionId/proctoring`. Each violation can be marked reviewed and annotated with a review note.
**Priority:** High
**Acceptance Criteria:**
- GET violations endpoint returns all violations for a submission.
- Each violation shows: type, description, severity, timestamp, screenshotUrl, reviewed status, reviewNote.
- PATCH violation endpoint sets `reviewed: true` and stores `reviewNote`.
- Screenshot thumbnail is displayed when `screenshotUrl` is available.
- Instructor can review violations from any submission, not just their own courses (admin can review all).

---

**FR-30**

**Title:** Tab Switch & Copy-Paste Detection
**Description:** During a proctored quiz, the client detects tab switches (via `visibilitychange` event) and copy-paste actions (via `copy` event). Each detection logs a violation and increments the counter.
**Priority:** High
**Acceptance Criteria:**
- Tab switch increments violation count and posts `tab_switch` violation.
- Copy-paste attempt increments violation count and posts `copy_paste` violation.
- Violation toast is shown to student.
- Both types count toward the violation threshold.

---

### 4.7 Module: Grading & Gradebook

---

**FR-31**

**Title:** Quiz Auto-Grading
**Description:** Quiz submissions are automatically graded on submission. For MCQ and true/false, answers are compared case-insensitively. For short answer and fill-blank, exact match (case-insensitive) is used. Score, totalPoints, and percentage are computed.
**Priority:** Critical
**Acceptance Criteria:**
- Grading computes `score` as sum of points for correct answers.
- `totalPoints` is sum of all question points.
- `percentage` = round((score / totalPoints) * 100).
- `percentage` is 0 when `totalPoints` is 0.
- Graded answers are stored in `answers` JSONB with `isCorrect` and `points` fields.
- `status` set to `graded` immediately on submission.

---

**FR-32**

**Title:** Gradebook
**Description:** Instructors access a gradebook per course showing a matrix of all enrolled students vs. all quizzes and assignments. For each cell: quiz scores shown as percentage, assignment scores shown as (score/maxScore)*100. Color coding: green >= 80%, yellow 60–79%, red < 60%.  Per-quiz summary (best/worst/average) is shown. The gradebook is exportable as CSV.
**Priority:** Critical
**Acceptance Criteria:**
- GET `/api/gradebook?courseId=` returns `students`, `quizzes`, `assignments`, `quizSummary`, `assignmentSummary`.
- Students list includes `quizResults` and `assignmentResults` for each student.
- `overallAverage` is computed per student.
- `quizSummary` includes `best`, `worst`, `average`, `count` per quiz.
- `assignmentSummary` includes `best`, `worst`, `average`, `count` per assignment.
- CSV export includes headers: Student Name, Email, [quiz titles], [assignment titles], Overall Average.
- CSV values use percentage format (e.g., "85%") or "—" for missing.
- Gradebook is accessible to Instructor and Admin only.

---

**FR-33**

**Title:** Student Performance Profile
**Description:** Instructors and admins can view a student's individual performance profile at `/students/:id`, showing quiz history, assignment history, score trends, and overall statistics. Students can view their own profile at `/my-profile`.
**Priority:** High
**Acceptance Criteria:**
- Instructor can view any enrolled student's profile.
- Student can view only their own profile.
- Profile shows quiz submission history with scores and dates.
- Profile shows assignment submission history with scores and dates.
- Overall average across all assessments is computed and displayed.

---

### 4.8 Module: Analytics

---

**FR-34**

**Title:** Course Analytics Dashboard
**Description:** Instructors view analytics for a selected course (or all courses) including: overview stats (total students, average score, pass rate, total submissions), score distribution chart, performance trend over time, top performers, low performers, quiz-level stats, and violation statistics.
**Priority:** High
**Acceptance Criteria:**
- GET `/api/analytics?courseId=` returns all analytics sections.
- `overview.totalStudents` reflects enrolled students.
- `overview.averageScore` is mean percentage across all graded quiz submissions.
- `overview.passRate` = (submissions with percentage >= passingScore) / total submitted.
- `scoreDistribution` contains buckets (e.g., 0–20%, 21–40%, etc.) with counts.
- `performanceTrend` contains date-averaged performance data.
- `topPerformers` lists students with highest average scores.
- `lowPerformers` lists students with lowest average scores.
- `violationStats` lists violation types with counts.
- `courseId=all` aggregates across all instructor's courses.

---

### 4.9 Module: AI Agentic Chatbot (Co-Pilot)

---

**FR-35**

**Title:** Co-Pilot Natural Language Command Processing
**Description:** Instructors send natural language commands to the co-pilot. The AI parses the command into structured intents and parameters, then executes each task sequentially. Live platform context (all courses, quizzes, assignments, students) is injected into the AI prompt. Recent conversation history (last 4 commands) is included for follow-up understanding.
**Priority:** Critical
**Acceptance Criteria:**
- POST `/api/chat/command` requires instructor or admin role; students receive 403.
- Command is processed through AI intent extraction yielding a `tasks` array.
- Each task is executed in sequence.
- Context includes current courses, quizzes, assignments, lectures, and students.
- Recent conversation history enables pronoun/reference resolution ("it", "that quiz", "the result").
- Multi-step commands (e.g., "create a course and add a quiz then publish it") are all executed in one request.
- Result message uses markdown (bold for names, checkmarks for success).
- A `chatCommand` record is created with status `executing` then updated to `completed` or `failed`.

---

**FR-36**

**Title:** Co-Pilot Supported Intents — Content Creation
**Description:** The co-pilot supports creating courses, quizzes (with optional AI question generation), assignments (with optional rubric), and lectures via natural language.
**Priority:** Critical
**Acceptance Criteria:**
- `create_course`: creates course with name, code, semester, description (code auto-generated if not specified).
- `create_quiz`: creates quiz in the specified course; if a topic is mentioned or `generateQuestions: true`, AI questions are generated.
- `create_assignment`: creates assignment with due date (defaults to +7 days if not specified), max score, and optional rubric.
- `create_lecture`: creates lecture with title, unit, description.
- Newly created entities are immediately available in subsequent tasks in the same request.

---

**FR-37**

**Title:** Co-Pilot Supported Intents — Update & Status
**Description:** The co-pilot can update any quiz/course/assignment/lecture fields and change quiz publish status (publish, unpublish, close, archive). "Publish all drafts" is supported.
**Priority:** High
**Acceptance Criteria:**
- `update_quiz`: finds quiz by fuzzy name match and updates only specified fields.
- `publish_quiz` with `quizName: "all"` publishes all draft quizzes.
- `unpublish_quiz`, `archive_quiz` change quiz status accordingly.
- `update_course`, `update_assignment`, `update_lecture` update respective entities.
- `publish_assignment` sets assignment status to published.

---

**FR-38**

**Title:** Co-Pilot Supported Intents — Listing & Querying
**Description:** The co-pilot can list courses, quizzes, assignments, lectures, students, enrollments, and submissions. It can also answer free-form questions about platform data.
**Priority:** High
**Acceptance Criteria:**
- `list_courses`, `list_quizzes`, `list_assignments`, `list_lectures`, `list_students` return formatted markdown lists.
- `list_enrollments` returns enrolled students for a named course.
- `list_submissions` returns submission results for a named quiz or assignment.
- `question` intent sends the question with full context to AI and returns a natural language answer.
- `help` returns a summary of available commands.

---

**FR-39**

**Title:** Co-Pilot Supported Intents — Student Management & Sharing
**Description:** The co-pilot can enroll/unenroll students by name or email, show individual student performance, and generate public quiz links.
**Priority:** High
**Acceptance Criteria:**
- `enroll_student`: finds student by name or email, enrolls them in named course.
- `unenroll_student`: removes enrollment.
- `show_student_performance`: returns student quiz/assignment history.
- `generate_public_link`: generates a public access token for a quiz with specified permission (`view` or `attempt`).

---

**FR-40**

**Title:** Co-Pilot Supported Intents — Grading & Navigation
**Description:** The co-pilot can trigger AI grading on assignment submissions and navigate the user to platform pages.
**Priority:** Medium
**Acceptance Criteria:**
- `ai_grade_all`: grades all ungraded submissions for the specified assignment.
- `view_analytics`: returns analytics summary.
- `view_gradebook`: provides gradebook link or data for specified course.
- `navigate`: returns a `navigateTo` route that the client uses to redirect the user.
- `summarize_lecture`: triggers lecture AI summarization.

---

### 4.10 Module: Settings & AI Provider Configuration

---

**FR-41**

**Title:** Multi-Provider AI Configuration
**Description:** Instructors and admins configure one or more AI provider API keys (Gemini, OpenAI, OpenRouter, Grok, Kimi, Anthropic, Custom OpenAI-compatible) and select the active provider. For Custom providers, a base URL and model name are also configurable.
**Priority:** High
**Acceptance Criteria:**
- GET `/api/settings/ai-providers` returns per-provider key status (masked), active provider.
- PUT `/api/settings/ai-providers` saves keys; empty string clears a key.
- Invalid `activeProvider` value returns 400 with list of valid options.
- API keys are never returned in plaintext; only masked (first 6 + last 4 chars).
- POST `/api/settings/test-ai-provider` sends a test prompt and returns `valid: true/false` with a descriptive message.
- Custom provider requires `baseUrl`; model is optional (defaults to `gpt-3.5-turbo`).
- Platform falls back to Gemini platform key when user has no active provider key set.

---

**FR-42**

**Title:** AI Provider Abstraction Layer
**Description:** All AI features in the system use a single `generateWithProvider` function that routes to the correct provider based on the user's active provider setting. Provider configs (default models, docs URL, key prefix) are centralized.
**Priority:** High
**Acceptance Criteria:**
- Gemini uses `@google/genai` SDK; others use OpenAI-compatible REST API.
- Anthropic uses its own Messages API format.
- System messages are handled per provider (Gemini concatenates to parts; Anthropic uses `system` field; OpenAI passes as `system` role).
- Multimodal image content is supported for Gemini and OpenAI-compatible providers.
- Failed API call throws descriptive error including provider name and HTTP status.

---

### 4.11 Module: Public Quiz Links

---

**FR-43**

**Title:** Public Quiz Link Generation
**Description:** Instructors generate a public link for any published quiz. The link uses a UUID access token. The link can be set to `view` (read-only) or `attempt` (submit). Required identification fields (e.g., name, email, student ID) are configurable.
**Priority:** High
**Acceptance Criteria:**
- POST `/api/quizzes/:id/generate-public-link` generates a `publicAccessToken` UUID and stores it.
- `publicLinkEnabled` is set to `true`.
- `requiredIdentificationFields` defaults to `["name", "email"]`.
- Full public URL is returned in the response.
- POST `/api/quizzes/:id/disable-public-link` sets `publicLinkEnabled: false` and clears token.
- Public link can be regenerated (new token).

---

**FR-44**

**Title:** Public Quiz Access & Submission (Unauthenticated)
**Description:** Unauthenticated users access a quiz via the public link. They must fill identification fields before attempting. Submissions are stored in `public_quiz_submissions` with IP address. Correct answers are not exposed in attempt mode.
**Priority:** High
**Acceptance Criteria:**
- GET `/api/public/quiz/:token` returns quiz and questions; `correctAnswer` is omitted in attempt mode.
- Quiz with disabled/invalid token returns 404.
- View-only link does not allow submission.
- POST `/api/public/quiz/:token/submit` grades the submission and stores result.
- Submission stores `ipAddress`, `identificationData`, `answers`, `score`, `percentage`.
- `passed` flag is returned based on `passingScore`.
- GET `/api/quizzes/:id/public-submissions` (instructor) returns all public submissions.

---

## 5. Non-Functional Requirements

---

**NFR-01 — Performance**
**Description:** The platform must handle concurrent users with acceptable response times.
**Criteria:**
- API responses for CRUD operations: < 500ms under normal load (1–50 concurrent users).
- AI generation endpoints: < 30 seconds timeout (dependent on provider SLA).
- Gradebook CSV export for 200 students × 20 assessments: < 3 seconds.
- Dashboard stats: < 1 second for courses with up to 500 students.

**NFR-02 — Security**
**Description:** The platform must protect user data and prevent unauthorized access.
**Criteria:**
- All endpoints (except public quiz and auth) require an authenticated session.
- bcrypt with cost factor >= 10 for all password and pattern storage.
- API keys are never transmitted to clients in plaintext.
- Session cookies are `httpOnly: true`, `secure: true` in production.
- SQL injection is prevented by Drizzle ORM parameterized queries.
- CSRF protection via session-based auth (no token-based bypass).
- Rate limiting must be implemented on login, registration, and AI endpoints (recommended: 10 req/min on auth, 5 req/min on AI generation).
- Admin actions are gated behind `requireAdmin` middleware.

**NFR-03 — Usability**
**Description:** The UI must be minimalist and accessible to first-time users (instructors and students with no technical background).
**Criteria:**
- First-time user can create a course and publish a quiz within 5 minutes without documentation.
- All forms have clear labels, inline validation messages, and descriptive error toasts.
- The sidebar navigation is clearly labeled with icons and text.
- Dark mode and light mode are supported and persisted.
- The AI Co-Pilot provides contextual quick-action buttons to guide new users.
- All loading states show skeleton loaders, not blank pages.

**NFR-04 — Accessibility**
**Description:** The platform should be usable by people with disabilities.
**Criteria:**
- Interactive elements (buttons, inputs, links) have keyboard focus support.
- Form fields have associated labels (for screen reader compatibility).
- Color is not the sole indicator of state (e.g., pass/fail also uses text/icon).
- WCAG 2.1 Level AA color contrast ratios are maintained.
- Toast notifications are screen-reader announced.

**NFR-05 — Reliability**
**Description:** The platform must handle errors gracefully without crashing.
**Criteria:**
- All server routes have try/catch blocks returning structured JSON errors.
- AI generation failures (provider error, network timeout) return user-friendly messages, not raw stack traces.
- Failed screenshot uploads during proctoring are non-fatal; violation is still logged.
- Server continues to operate if the AI provider is temporarily unavailable.
- Database connection loss must be surfaced as 503 with retry guidance.

**NFR-06 — Scalability**
**Description:** The system architecture should support growth.
**Criteria:**
- Storage layer is abstracted via `IStorage` interface, enabling database swap without route changes.
- AI provider is abstracted via `generateWithProvider`; new providers can be added without touching routes.
- Object storage uses a pluggable GCS-compatible service.

**NFR-07 — Data Integrity**
**Description:** Data relationships must remain consistent.
**Criteria:**
- Cascade deletes: `course` → `quizzes`, `assignments`, `lectures`, `enrollments`, `questions`.
- Cascade deletes: `quiz` → `quiz_questions`, `quiz_submissions`.
- Cascade deletes: `quiz_submission` → `proctoring_violations`.
- Cascade deletes: `user` → `enrollments`, `quiz_submissions`, `assignment_submissions`.
- `lecture` deletion sets `lectureId` to null on questions (not cascade delete).

---

## 6. Use Cases

---

### UC-01: Instructor Creates AI-Generated Quiz

**Actor:** Instructor
**Preconditions:** Instructor is logged in; at least one course exists; AI provider is configured.
**Main Flow:**
1. Instructor navigates to Quiz Builder or uses Co-Pilot.
2. Selects a course and enters quiz title, time limit, passing score, and proctoring settings.
3. Enters a topic in the AI generation field or uploads a file.
4. Clicks "Generate Questions"; system calls `/api/ai/generate-questions` or `/api/ai/generate-questions-from-file`.
5. AI returns 5–10 questions; instructor reviews and edits as needed.
6. Instructor clicks "Save Quiz" (status: draft).
7. Instructor clicks "Publish" to make it available to students.
**Alternate Flow:** AI provider is unavailable → error toast is shown; instructor can add questions manually.
**Postconditions:** Quiz is saved with `published` status; enrolled students can see it.

---

### UC-02: Student Takes Proctored Quiz

**Actor:** Student
**Preconditions:** Student is enrolled in the course; quiz is published with `proctored: true`.
**Main Flow:**
1. Student navigates to `/quiz/:id/take`.
2. System requests webcam permission; student grants it.
3. Student clicks "Start Quiz"; a submission record is created.
4. Student answers questions; webcam feed is analyzed every N seconds.
5. Tab switch detected → violation logged, counter incremented, toast shown.
6. Student reaches the last question and clicks "Submit".
7. System grades the submission and redirects to results page.
**Alternate Flow A:** Webcam permission denied → student sees error; quiz cannot be started.
**Alternate Flow B:** Violations reach threshold → quiz is auto-submitted; student is notified.
**Postconditions:** Submission is graded; violations are stored; instructor can review proctoring log.

---

### UC-03: Instructor Grades Assignment with AI

**Actor:** Instructor
**Preconditions:** Assignment is published; at least one student has submitted.
**Main Flow:**
1. Instructor navigates to Assignments → [Assignment] → Submissions.
2. Instructor clicks "Grade" on a student submission.
3. System displays submission content, rubric, AI content score, plagiarism score.
4. Instructor clicks "AI Grade" button.
5. AI analyzes submission against rubric; scores and feedback are populated.
6. Instructor reviews AI scores, adjusts if needed, adds manual feedback.
7. Instructor clicks "Save Grade".
**Alternate Flow:** Assignment has no rubric → AI grading generates general feedback; single overall score is used.
**Postconditions:** Submission status is `graded`; score and feedback are stored; visible in gradebook.

---

### UC-04: Instructor Uses Co-Pilot to Set Up a Full Course

**Actor:** Instructor
**Preconditions:** Instructor is logged in; no existing courses.
**Main Flow:**
1. Instructor opens Co-Pilot chatbot.
2. Types: "Create a course called Machine Learning with code ML301, add a 10-question quiz on neural networks with 30 minute time limit, and create an assignment on CNNs due in 2 weeks, then publish both."
3. Co-Pilot parses 4 intents: `create_course`, `create_quiz`, `create_assignment`, `publish_quiz` + `publish_assignment`.
4. All tasks execute sequentially; Co-Pilot reports success for each.
5. Instructor sees the new course, quiz (published, 10 AI questions), and assignment (published).
**Alternate Flow:** Named course doesn't exist for quiz creation → Co-Pilot uses the just-created course from in-memory context.
**Postconditions:** Full course is set up; students can enroll and take the quiz.

---

### UC-05: Student Accesses Quiz via Public Link

**Actor:** Anonymous User (guest / unauthenticated)
**Preconditions:** Instructor has generated a public attempt link for a published quiz.
**Main Flow:**
1. Instructor shares the public URL.
2. Guest visits `/public/quiz/:token` without logging in.
3. Guest fills identification form (name, email, student ID as required).
4. Guest takes the quiz and submits.
5. System grades and displays score to guest.
6. Submission stored in `public_quiz_submissions` with IP address.
**Alternate Flow:** Link has been disabled → 404 error is shown.
**Postconditions:** Submission stored; accessible to instructor via public submissions list.

---

### UC-06: Admin Manages User Accounts

**Actor:** Admin
**Preconditions:** Admin is logged in.
**Main Flow:**
1. Admin navigates to `/users`.
2. Admin views all users with filtering by role.
3. Admin creates a new instructor account with email, username, and password.
4. Admin updates an existing student's email.
5. Admin deletes a student account.
**Alternate Flow:** Admin attempts to delete own account → blocked with 400 error.
**Postconditions:** User database reflects all changes; affected users' sessions are invalidated on next request.

---

### UC-07: Instructor Exports Gradebook

**Actor:** Instructor
**Preconditions:** Instructor has at least one course with enrolled students and graded submissions.
**Main Flow:**
1. Instructor navigates to `/gradebook`.
2. Selects a course from the dropdown.
3. Reviews the grade matrix (color-coded cells).
4. Clicks "Export CSV".
5. Browser downloads a CSV file named `gradebook-[course-name].csv`.
**Alternate Flow:** No submissions exist → export produces headers only with "—" for all score cells.
**Postconditions:** CSV file is on user's machine; data matches on-screen gradebook.

---

### UC-08: Instructor Reviews Proctoring Violations

**Actor:** Instructor
**Preconditions:** A student has completed a proctored quiz with violations recorded.
**Main Flow:**
1. Instructor navigates to quiz submissions.
2. Clicks "Review Proctoring" for a specific submission.
3. System displays violation list with type, severity, timestamp, and screenshot thumbnails.
4. Instructor reads each violation and clicks "Mark Reviewed".
5. Instructor adds a review note explaining their judgment.
**Alternate Flow:** No violations exist → page shows "No violations recorded" message.
**Postconditions:** Violations marked as `reviewed: true` with notes stored; grade decision is at instructor's discretion.

---

### UC-09: Instructor Configures AI Provider

**Actor:** Instructor
**Preconditions:** Instructor has an API key from a supported provider.
**Main Flow:**
1. Instructor navigates to Settings → AI Providers.
2. Selects OpenRouter from the provider list.
3. Enters API key starting with `sk-or-`.
4. Clicks "Test Connection" → system calls test endpoint and returns "✅ OpenRouter is working".
5. Saves key and sets OpenRouter as the active provider.
**Alternate Flow:** Invalid API key → test returns "❌ [error message from provider]"; key not saved.
**Postconditions:** All AI features (question generation, grading, chatbot) now use OpenRouter.

---

### UC-10: Student Resets Forgotten Password

**Actor:** Student
**Preconditions:** Student has a registered email address.
**Main Flow:**
1. Student navigates to `/forgot-password`.
2. Enters registered email address.
3. Receives email with reset link (valid 1 hour).
4. Clicks link; navigates to `/reset-password/:token`.
5. Enters and confirms new password (min 6 chars).
6. System updates password; student is prompted to log in.
**Alternate Flow A:** Unknown email → same success message shown (no enumeration).
**Alternate Flow B:** Expired token → "This reset link has expired" error.
**Alternate Flow C:** Already-used token → "This reset link has already been used" error.
**Postconditions:** Student can log in with new password; reset token is marked used.

---

## 7. QA Test Cases

---

### Module: Authentication & Account Management

| TC-ID | Requirement | Test Title | Preconditions | Test Steps | Expected Result | Priority |
|-------|-------------|-----------|---------------|------------|-----------------|----------|
| TC-AUTH-01 | FR-01 | Successful registration — student | App running, no existing user with test credentials | 1. POST /api/auth/register with valid name, email, username, password, role="student" | HTTP 201, sanitized user object returned (no password field), session created | Critical |
| TC-AUTH-02 | FR-01 | Successful registration — instructor | Same | POST with role="instructor" | HTTP 201, role is "instructor" in response | Critical |
| TC-AUTH-03 | FR-01 | Duplicate username rejected | User "john" exists | POST with username="john" | HTTP 400, error "Username already exists" | Critical |
| TC-AUTH-04 | FR-01 | Duplicate email rejected | Email "a@b.com" exists | POST with email="a@b.com" | HTTP 400, error "Email already exists" | Critical |
| TC-AUTH-05 | FR-01 | Short password rejected | None | POST with password="12345" (5 chars) | HTTP 400, validation error | Critical |
| TC-AUTH-06 | FR-01 | Short username rejected | None | POST with username="ab" (2 chars) | HTTP 400, validation error | High |
| TC-AUTH-07 | FR-01 | Short name rejected | None | POST with name="A" (1 char) | HTTP 400, validation error | High |
| TC-AUTH-08 | FR-01 | Invalid role rejected | None | POST with role="admin" | HTTP 400 (admin not a valid self-registration role) | High |
| TC-AUTH-09 | FR-01 | Missing required fields | None | POST with empty body {} | HTTP 400, Zod validation error | High |
| TC-AUTH-10 | FR-01 | Password field absent from response | None | POST valid registration | Response body must not contain "password" field | Critical |
| TC-AUTH-11 | FR-01 | Email with special characters | None | POST with email="test+1@domain.co.uk" | HTTP 201, registration succeeds | Medium |
| TC-AUTH-12 | FR-01 | Username with max length (255 chars) | None | POST with 255-char username | HTTP 201 if schema allows; verify DB truncation or validation | Low |
| TC-AUTH-13 | FR-02 | Successful login | User exists with hashed password | POST /api/auth/login with correct credentials | HTTP 200, user object, session cookie set | Critical |
| TC-AUTH-14 | FR-02 | Wrong password | User exists | POST with correct username, wrong password | HTTP 401, "Invalid credentials" | Critical |
| TC-AUTH-15 | FR-02 | Non-existent username | No such user | POST with unknown username | HTTP 401, "Invalid credentials" (same message, no enumeration) | Critical |
| TC-AUTH-16 | FR-02 | Authenticated user visits /login | User logged in | Navigate to /login | Redirect to /dashboard | High |
| TC-AUTH-17 | FR-02 | Empty credentials | None | POST with empty username and password | HTTP 401 | High |
| TC-AUTH-18 | FR-03 | Pattern login — correct pattern | User has pattern set | POST /api/auth/pattern-login with correct username + pattern | HTTP 200, session created | High |
| TC-AUTH-19 | FR-03 | Pattern login — wrong pattern | User has pattern set | POST with correct username + wrong pattern | HTTP 401 "Invalid credentials" | High |
| TC-AUTH-20 | FR-03 | Pattern login — pattern too short | None | POST with pattern=[0,1,2] (3 dots) | HTTP 400 "must connect at least 4 dots" | High |
| TC-AUTH-21 | FR-03 | Pattern login — user with no pattern set | User has no pattern | POST pattern login | HTTP 401 "Invalid credentials" | Medium |
| TC-AUTH-22 | FR-04 | Set valid pattern lock | User authenticated | PUT /api/settings/pattern with pattern=[0,1,3,6,8] | HTTP 200, enabled: true | High |
| TC-AUTH-23 | FR-04 | Pattern with duplicate dots | User authenticated | PUT with pattern=[0,1,1,3] | HTTP 400 "Invalid pattern: must be unique dots" | High |
| TC-AUTH-24 | FR-04 | Pattern with out-of-range dot | User authenticated | PUT with pattern=[0,1,2,9] | HTTP 400 | High |
| TC-AUTH-25 | FR-04 | Remove pattern lock | User has pattern set | DELETE /api/settings/pattern | HTTP 200, enabled: false; subsequent pattern login fails | Medium |
| TC-AUTH-26 | FR-05 | Forgot password — registered email | User with email exists | POST /api/auth/forgot-password | HTTP 200, generic success message; check DB for token | High |
| TC-AUTH-27 | FR-05 | Forgot password — unknown email | No such email | POST /api/auth/forgot-password | HTTP 200, same generic message (no enumeration) | High |
| TC-AUTH-28 | FR-05 | Reset password — valid token | Valid unexpired token in DB | POST /api/auth/reset-password with token + newPassword | HTTP 200 "Password has been reset"; token marked used; new password works | High |
| TC-AUTH-29 | FR-05 | Reset password — expired token | Token with past expiry | POST /api/auth/reset-password | HTTP 400 "expired" | High |
| TC-AUTH-30 | FR-05 | Reset password — used token | Token already used | POST /api/auth/reset-password | HTTP 400 "already been used" | High |
| TC-AUTH-31 | FR-05 | Reset password — short new password | Valid token | POST with newPassword="12345" | HTTP 400 "at least 6 characters" | High |
| TC-AUTH-32 | FR-05 | Reset password — invalid token | Random string | POST with random token | HTTP 400 "Invalid or expired reset link" | High |
| TC-AUTH-33 | FR-06 | Forgot username — registered email | User exists | POST /api/auth/forgot-username | HTTP 200 generic message | Medium |
| TC-AUTH-34 | FR-07 | Successful logout | User is logged in | POST /api/auth/logout | HTTP 200; subsequent GET /api/auth/me returns 401 | Critical |
| TC-AUTH-35 | FR-08 | Admin lists all users | Admin session | GET /api/users | HTTP 200, array of all users | High |
| TC-AUTH-36 | FR-08 | Admin filters by role | Admin session | GET /api/users?role=student | Only students returned | High |
| TC-AUTH-37 | FR-08 | Non-admin access to /api/users | Instructor session | GET /api/users | HTTP 403 | Critical |
| TC-AUTH-38 | FR-08 | Admin creates user with admin role | Admin session | POST /api/users with role="admin" | HTTP 201, new admin created | High |
| TC-AUTH-39 | FR-08 | Admin deletes own account | Admin logged in | DELETE /api/users/:own-id | HTTP 400 "Cannot delete your own account" | Critical |
| TC-AUTH-40 | FR-08 | Admin changes user role | Admin session | PATCH /api/users/:id with role="instructor" | HTTP 200, role updated | High |

---

### Module: Course Management

| TC-ID | Requirement | Test Title | Preconditions | Test Steps | Expected Result | Priority |
|-------|-------------|-----------|---------------|------------|-----------------|----------|
| TC-COURSE-01 | FR-09 | Create course — valid | Instructor session | POST /api/courses with name, code, semester | HTTP 201, course object returned | Critical |
| TC-COURSE-02 | FR-09 | Create course — missing name | Instructor session | POST /api/courses without name | HTTP 400 validation error | High |
| TC-COURSE-03 | FR-09 | Student cannot create course | Student session | POST /api/courses | HTTP 403 | Critical |
| TC-COURSE-04 | FR-09 | Student sees only enrolled courses | Student enrolled in 1 of 3 courses | GET /api/courses | Returns only 1 enrolled course | Critical |
| TC-COURSE-05 | FR-09 | Instructor sees own courses only | Instructor with 2 courses; another instructor has 1 | GET /api/courses | Returns only own 2 courses | High |
| TC-COURSE-06 | FR-09 | Admin sees all courses | Admin session | GET /api/courses | Returns all courses from all instructors | High |
| TC-COURSE-07 | FR-09 | Update course name | Instructor session, own course | PUT /api/courses/:id with new name | HTTP 200, updated course returned | High |
| TC-COURSE-08 | FR-09 | Delete course cascades | Course has quizzes and assignments | DELETE /api/courses/:id | HTTP 200; quizzes and assignments also deleted | High |
| TC-COURSE-09 | FR-09 | Delete non-existent course | Instructor session | DELETE /api/courses/nonexistent | HTTP 404 | Medium |
| TC-COURSE-10 | FR-10 | Import valid CSV | Instructor session, valid CSV file | POST /api/courses/import with base64 CSV | HTTP 201, all valid rows imported | Medium |
| TC-COURSE-11 | FR-10 | Import file too large | Instructor session | POST with file > 5MB | HTTP 400 "File too large" | Medium |
| TC-COURSE-12 | FR-10 | Import more than 500 rows | Instructor session | POST with 501-row CSV | HTTP 400 "Too many rows" | Medium |
| TC-COURSE-13 | FR-10 | Import unsupported file type | Instructor session | POST with fileType="txt" | HTTP 400 "Unsupported file type" | Medium |
| TC-COURSE-14 | FR-10 | Import CSV with some invalid rows | Instructor session | POST CSV with 3 valid, 2 invalid rows | Partial import; errors listed in response | Medium |
| TC-COURSE-15 | FR-11 | Enroll student by ID | Instructor session, student exists | POST /api/courses/:id/enroll with studentId | HTTP 201, enrollment created | High |
| TC-COURSE-16 | FR-11 | Enroll student by email | Instructor session | POST with studentEmail | HTTP 201 | High |
| TC-COURSE-17 | FR-11 | Re-enroll already enrolled student | Student already enrolled | POST enroll again | HTTP 200 "Already enrolled" | High |
| TC-COURSE-18 | FR-11 | Enroll non-existent student email | Instructor session | POST with unknown email | HTTP 404 "Student not found" | High |
| TC-COURSE-19 | FR-11 | Student cannot enroll others | Student session | POST /api/courses/:id/enroll | HTTP 403 | Critical |
| TC-COURSE-20 | FR-11 | Missing both studentId and studentEmail | Instructor session | POST with no identifier | HTTP 400 | High |

---

### Module: Quiz Management

| TC-ID | Requirement | Test Title | Preconditions | Test Steps | Expected Result | Priority |
|-------|-------------|-----------|---------------|------------|-----------------|----------|
| TC-QUIZ-01 | FR-12 | Create quiz — minimal fields | Instructor, course exists | POST /api/quizzes with title and courseId | HTTP 201, status="draft", defaults applied | Critical |
| TC-QUIZ-02 | FR-12 | Create quiz with questions | Instructor, course exists | POST /api/quizzes with questions array | HTTP 201; questions created and linked | Critical |
| TC-QUIZ-03 | FR-12 | Student cannot create quiz | Student session | POST /api/quizzes | HTTP 403 | Critical |
| TC-QUIZ-04 | FR-12 | AI-generated questions flagged | Instructor, AI question in questions[] | POST quiz with question having id starting "ai-" | Question stored with aiGenerated=true | High |
| TC-QUIZ-05 | FR-13 | Publish quiz | Instructor, draft quiz | PATCH /api/quizzes/:id/publish | HTTP 200, status="published" | Critical |
| TC-QUIZ-06 | FR-13 | Student sees only published quizzes | Student enrolled in course | GET /api/quizzes | Only published quizzes returned | Critical |
| TC-QUIZ-07 | FR-13 | Publish non-existent quiz | Instructor | PATCH /api/quizzes/nonexistent/publish | HTTP 404 | Medium |
| TC-QUIZ-08 | FR-14 | Student takes quiz — questions returned | Student enrolled, quiz published | GET /api/quiz/:id/take | Questions returned without correctAnswer field | Critical |
| TC-QUIZ-09 | FR-14 | Question randomization | Quiz with randomizeQuestions=true | GET /api/quiz/:id/take multiple times | Order varies between requests | High |
| TC-QUIZ-10 | FR-14 | Start quiz creates submission | Student session, quiz published | POST /api/quiz/:id/start | Submission record with status="in_progress" created | Critical |
| TC-QUIZ-11 | FR-14 | Submit quiz — correct answers graded | Student session, MCQ quiz | POST /api/quiz/:id/submit with all correct answers | score == totalPoints, percentage == 100 | Critical |
| TC-QUIZ-12 | FR-14 | Submit quiz — mixed answers | MCQ quiz | POST with some correct, some wrong | Correct percentage computed; gradedAnswers has isCorrect flags | Critical |
| TC-QUIZ-13 | FR-14 | Submit quiz — all wrong | MCQ quiz | POST with all wrong answers | score == 0, percentage == 0 | High |
| TC-QUIZ-14 | FR-14 | Submit quiz — case-insensitive matching | Short answer question | POST with answer in different case | Correct answer matched case-insensitively | High |
| TC-QUIZ-15 | FR-14 | Submit with zero total points | Quiz with 0-point questions | Submit | percentage == 0 (no divide-by-zero) | High |
| TC-QUIZ-16 | FR-14 | Submit non-existent submission | Any | POST /api/quiz/:id/submit with fake submissionId | HTTP 404 "Submission not found" | Medium |
| TC-QUIZ-17 | FR-15 | Quiz results displayed correctly | Student has graded submission | GET quiz results page | Score, percentage, per-question breakdown shown | High |
| TC-QUIZ-18 | FR-16 | Edit quiz title | Instructor, own quiz | PUT /api/quizzes/:id with new title | HTTP 200, updated title returned | High |
| TC-QUIZ-19 | FR-16 | Add question to existing quiz | Instructor | POST question creation + add to quiz | Question linked with correct orderIndex | High |
| TC-QUIZ-20 | FR-17 | Delete quiz | Instructor, own quiz | DELETE /api/quizzes/:id | HTTP 200; quiz and linked questions/submissions removed | High |
| TC-QUIZ-21 | FR-12 | Quiz with special characters in title | Instructor | POST quiz with title containing "<script>alert(1)</script>" | Stored and returned as-is (escaped in HTML, stored as text) | Medium |
| TC-QUIZ-22 | FR-12 | Quiz time limit of 0 minutes | Instructor | POST quiz with timeLimitMinutes=0 | Stored; client must handle 0 as "no limit" or reject | Low |
| TC-QUIZ-23 | FR-14 | Unauthenticated access to quiz take page | No session | GET /api/quiz/:id/take | HTTP 401 | Critical |

---

### Module: Assignment Management

| TC-ID | Requirement | Test Title | Preconditions | Test Steps | Expected Result | Priority |
|-------|-------------|-----------|---------------|------------|-----------------|----------|
| TC-ASSIGN-01 | FR-18 | Create assignment — minimal | Instructor, course exists | POST /api/assignments with title, courseId, maxScore | HTTP 201, status="draft", defaults applied | Critical |
| TC-ASSIGN-02 | FR-18 | Create assignment with rubric | Instructor | POST with rubric array | HTTP 201, rubric stored in JSONB | High |
| TC-ASSIGN-03 | FR-18 | Student cannot create assignment | Student session | POST /api/assignments | HTTP 403 | Critical |
| TC-ASSIGN-04 | FR-18 | Late penalty stored | Instructor | POST with latePenaltyPercent=20 | Stored correctly; retrievable | Medium |
| TC-ASSIGN-05 | FR-19 | Student submits text content | Student enrolled, published assignment | POST submission with content | HTTP 200/201, submission stored | Critical |
| TC-ASSIGN-06 | FR-19 | Student submits file | Student enrolled | POST submission with fileUrl | File URL stored in submission | High |
| TC-ASSIGN-07 | FR-19 | Late submission rejected | Assignment past due, allowLateSubmission=false | POST submission | HTTP 400 or submission marked late | High |
| TC-ASSIGN-08 | FR-19 | Late submission accepted | Assignment past due, allowLateSubmission=true | POST submission | Submission accepted; late flag noted | High |
| TC-ASSIGN-09 | FR-19 | Student submits outside enrolled course | Student not enrolled | POST submission | HTTP 403 or 404 | Critical |
| TC-ASSIGN-10 | FR-20 | AI grade assignment | Instructor, submission exists | POST AI grade endpoint | Rubric scores populated, aiFeedback set, status="graded" | Critical |
| TC-ASSIGN-11 | FR-20 | Manual grade assignment | Instructor | PATCH submission with score + instructorFeedback | HTTP 200, grade stored | Critical |
| TC-ASSIGN-12 | FR-20 | AI content score stored | Instructor grades | AI grading invoked | aiContentScore (0–100) stored on submission | High |
| TC-ASSIGN-13 | FR-20 | Plagiarism score stored | Multiple submissions for same assignment | AI grading invoked | plagiarismScore populated | High |
| TC-ASSIGN-14 | FR-20 | Student cannot access grading endpoint | Student session | POST grade endpoint | HTTP 403 | Critical |
| TC-ASSIGN-15 | FR-21 | List submissions — instructor sees all | Instructor, 3 submissions exist | GET /api/assignments/:id/submissions | All 3 submissions returned with student names | High |
| TC-ASSIGN-16 | FR-21 | Bulk AI grade — all ungraded | Instructor, 3 ungraded submissions | Trigger bulk AI grade | All 3 graded; no already-graded submissions re-graded | High |

---

### Module: AI Question & Content Generation

| TC-ID | Requirement | Test Title | Preconditions | Test Steps | Expected Result | Priority |
|-------|-------------|-----------|---------------|------------|-----------------|----------|
| TC-AI-01 | FR-22 | Generate questions — text input | Instructor, AI configured | POST /api/ai/generate-questions with content | HTTP 200, questions array with correct structure | Critical |
| TC-AI-02 | FR-22 | MCQ question has 4 options | AI generation | Examine MCQ questions in response | Each MCQ has exactly 4 options | Critical |
| TC-AI-03 | FR-22 | True/False question options | AI generation | Examine true_false questions | Options are ["True", "False"] | High |
| TC-AI-04 | FR-22 | Short answer has empty options | AI generation | Examine short_answer questions | options: [] | High |
| TC-AI-05 | FR-22 | Difficulty levels are valid | AI generation | Examine difficulty field | Each is "easy", "medium", or "hard" | High |
| TC-AI-06 | FR-22 | Points are integer 1–3 | AI generation | Examine points field | Each is integer in range 1–3 | High |
| TC-AI-07 | FR-22 | numQuestions parameter honored | Request 10 questions | POST with numQuestions=10 | Response contains up to 10 questions (AI may return fewer) | High |
| TC-AI-08 | FR-22 | Mixed difficulty returns varied levels | difficulty="mixed" | POST with difficulty="mixed" | Questions vary in difficulty (not all same level) | Medium |
| TC-AI-09 | FR-22 | AI unavailable — graceful error | AI provider key invalid/missing | POST generate-questions | HTTP 500 with descriptive message, not stack trace | High |
| TC-AI-10 | FR-22 | Student cannot generate questions | Student session | POST /api/ai/generate-questions | HTTP 403 | Critical |
| TC-AI-11 | FR-22 | Missing content field | Instructor | POST without content field | HTTP 400 or graceful error | Medium |
| TC-AI-12 | FR-23 | Generate from image file | Instructor, image fileUrl available | POST /api/ai/generate-questions-from-file with image fileType | Questions generated from image content | High |
| TC-AI-13 | FR-23 | Generate from PDF file | Instructor, PDF fileUrl available | POST with PDF fileType | Questions generated from document | High |
| TC-AI-14 | FR-23 | Missing fileUrl | Instructor | POST without fileUrl | HTTP 400 "File URL is required" | High |
| TC-AI-15 | FR-24 | Lecture summarization | Instructor, lecture with description | POST /api/lectures/:id/generate-summary | summary and keyPoints stored; response contains both | Medium |
| TC-AI-16 | FR-24 | Summarize non-existent lecture | Instructor | POST with invalid lecture ID | HTTP 404 "Lecture not found" | Medium |
| TC-AI-17 | FR-24 | Summarize lecture with no content | Instructor, lecture with empty description | POST generate-summary | AI generates based on title alone; no crash | Low |
| TC-AI-18 | FR-25 | AI content score range | Assignment grading | Trigger AI grade | aiContentScore is integer 0–100 | High |
| TC-AI-19 | FR-26 | Plagiarism detection — identical submissions | Two identical submissions for same assignment | AI grade both | High plagiarism score on second submission | High |
| TC-AI-20 | FR-26 | Plagiarism detection — unique submissions | Two completely different submissions | AI grade | Low plagiarism scores on both | High |

---

### Module: Proctoring & Academic Integrity

| TC-ID | Requirement | Test Title | Preconditions | Test Steps | Expected Result | Priority |
|-------|-------------|-----------|---------------|------------|-----------------|----------|
| TC-PROC-01 | FR-27 | Proctored quiz requests webcam | Student, proctored quiz | Navigate to quiz take page | Camera permission dialog shown | Critical |
| TC-PROC-02 | FR-27 | Non-proctored quiz — no camera | Student, non-proctored quiz | Navigate to quiz take page | No camera permission requested | High |
| TC-PROC-03 | FR-27 | Tab switch violation logged | Student taking proctored quiz | Switch browser tab | POST /api/proctoring/violation called with type="tab_switch"; counter incremented | Critical |
| TC-PROC-04 | FR-27 | Copy-paste violation logged | Student taking proctored quiz | Attempt copy (Ctrl+C) | Violation logged with type="copy_paste" | High |
| TC-PROC-05 | FR-27 | Auto-submit at threshold | violationThreshold=3 | Trigger 3 violations | Quiz auto-submitted; student notified | Critical |
| TC-PROC-06 | FR-27 | Violation counter displayed to student | Student in proctored quiz | After each violation | Counter visible in real time | High |
| TC-PROC-07 | FR-28 | Frame analysis — no violations | Instructor/student, clean frame | POST /api/proctoring/analyze-frame | violations: [] | High |
| TC-PROC-08 | FR-28 | Frame analysis — face not visible | Dark or blocked frame | POST analyze-frame | violations contains {type: "no_face"} | High |
| TC-PROC-09 | FR-28 | Frame analysis — phone detected | Frame showing phone | POST analyze-frame | violations contains {type: "phone_detected"} | High |
| TC-PROC-10 | FR-28 | Screenshot stored on violation | Violation detected | POST analyze-frame with violation | screenshotPath returned and stored on violation record | High |
| TC-PROC-11 | FR-28 | Screenshot not stored for clean frame | No violation | POST analyze-frame | No screenshot upload attempted | Medium |
| TC-PROC-12 | FR-28 | Screenshot upload fails silently | Object storage unavailable | POST analyze-frame with violation | Violation still logged; screenshotUrl is null; no 500 error | High |
| TC-PROC-13 | FR-29 | Instructor views violation list | Submission has violations | GET /api/quiz/:id/submissions/:sub/proctoring | All violations returned with type, severity, timestamp | High |
| TC-PROC-14 | FR-29 | Mark violation as reviewed | Instructor session | PATCH violation with reviewed=true and note | HTTP 200; violation record updated | High |
| TC-PROC-15 | FR-29 | Violation screenshot thumbnail shown | screenshotUrl set on violation | View proctoring review page | Image displayed inline | Medium |
| TC-PROC-16 | FR-29 | Student cannot access proctoring review | Student session | GET proctoring review endpoint | HTTP 403 | Critical |
| TC-PROC-17 | FR-27 | Webcam denied — quiz blocked | Student denies camera | Attempt to start proctored quiz | Error message shown; quiz cannot be started | Critical |
| TC-PROC-18 | FR-28 | Unauthenticated analyze-frame | No session | POST /api/proctoring/analyze-frame | HTTP 401 | Critical |

---

### Module: Grading & Gradebook

| TC-ID | Requirement | Test Title | Preconditions | Test Steps | Expected Result | Priority |
|-------|-------------|-----------|---------------|------------|-----------------|----------|
| TC-GRADE-01 | FR-31 | Perfect score computation | 5 questions, 2pts each; all correct | Submit quiz | score=10, totalPoints=10, percentage=100 | Critical |
| TC-GRADE-02 | FR-31 | Partial score computation | 5 questions, 2pts each; 3 correct | Submit quiz | score=6, totalPoints=10, percentage=60 | Critical |
| TC-GRADE-03 | FR-31 | Zero score computation | All wrong | Submit quiz | score=0, percentage=0 | Critical |
| TC-GRADE-04 | FR-31 | Zero total points edge case | All questions with points=0 | Submit quiz | percentage=0 (no divide-by-zero error) | High |
| TC-GRADE-05 | FR-31 | isCorrect flag in gradedAnswers | Submit with mix | Check submission.answers | Each answer has isCorrect boolean | High |
| TC-GRADE-06 | FR-31 | Case-insensitive answer matching | Short answer "Paris" vs "paris" | Submit quiz | isCorrect=true | High |
| TC-GRADE-07 | FR-32 | Gradebook returns enrolled students | 3 students enrolled, 2 quizzes, 1 assignment | GET /api/gradebook?courseId= | students array has 3 entries with quizResults and assignmentResults | Critical |
| TC-GRADE-08 | FR-32 | Gradebook quiz summary — best/worst/average | 3 students with scores 50/70/90 | GET gradebook | quizSummary.best=90, worst=50, average=70 | Critical |
| TC-GRADE-09 | FR-32 | Gradebook overall average per student | Student with 2 quiz scores 80/60 | GET gradebook | overallAverage=70 | High |
| TC-GRADE-10 | FR-32 | Gradebook — no submissions shows null | Student enrolled, no submissions | GET gradebook | score shows null, not 0 | High |
| TC-GRADE-11 | FR-32 | CSV export — headers correct | Instructor, gradebook loaded | Click Export CSV | Downloaded CSV has Student Name, Email, [quizzes], [assignments], Overall Average headers | High |
| TC-GRADE-12 | FR-32 | CSV export — values match UI | Instructor, scores visible in UI | Export CSV | CSV values match on-screen percentages | High |
| TC-GRADE-13 | FR-32 | CSV export — missing scores show dash | Student with no submission | Export CSV | Cell shows "—" not blank or 0 | Medium |
| TC-GRADE-14 | FR-32 | Student cannot access gradebook | Student session | GET /api/gradebook | HTTP 403 | Critical |
| TC-GRADE-15 | FR-32 | Gradebook with all courses | courseId=all | GET /api/gradebook (no filter) | All courses' data aggregated | Medium |
| TC-GRADE-16 | FR-33 | Student profile — own profile | Student session | GET /my-profile | Own quiz/assignment history returned | High |
| TC-GRADE-17 | FR-33 | Instructor views student profile | Instructor session, enrolled student | GET /students/:id | Student's assessment history displayed | High |
| TC-GRADE-18 | FR-33 | Student cannot view other student's profile | Student session | GET /students/:other-id | HTTP 403 or redirect to own profile | High |

---

### Module: Analytics

| TC-ID | Requirement | Test Title | Preconditions | Test Steps | Expected Result | Priority |
|-------|-------------|-----------|---------------|------------|-----------------|----------|
| TC-ANAL-01 | FR-34 | Analytics overview — totalStudents | 3 students enrolled | GET /api/analytics | overview.totalStudents=3 | High |
| TC-ANAL-02 | FR-34 | Analytics overview — averageScore | 3 submissions with 50/70/90 | GET /api/analytics | overview.averageScore=70 | High |
| TC-ANAL-03 | FR-34 | Analytics overview — passRate | 2 of 3 submissions above passing score | GET /api/analytics | overview.passRate~66.7% | High |
| TC-ANAL-04 | FR-34 | Score distribution — correct buckets | Submissions at various scores | GET /api/analytics | scoreDistribution has correct range counts | High |
| TC-ANAL-05 | FR-34 | topPerformers — correct ordering | 5 students | GET /api/analytics | topPerformers sorted descending by score | High |
| TC-ANAL-06 | FR-34 | lowPerformers — correct ordering | 5 students | GET /api/analytics | lowPerformers sorted ascending by score | High |
| TC-ANAL-07 | FR-34 | violationStats — counts per type | Proctored quiz with violations | GET /api/analytics | violationStats lists each type with count | High |
| TC-ANAL-08 | FR-34 | Analytics filtered by courseId | 2 courses, different student pools | GET /api/analytics?courseId=X | Only course X data returned | High |
| TC-ANAL-09 | FR-34 | Analytics with courseId=all | Multiple courses | GET /api/analytics?courseId=all | All courses aggregated | Medium |
| TC-ANAL-10 | FR-34 | Student cannot view analytics | Student session | GET /api/analytics | HTTP 403 | Critical |
| TC-ANAL-11 | FR-34 | Analytics with no submissions | Empty course | GET /api/analytics | Returns empty/zero values; no crash | High |
| TC-ANAL-12 | FR-34 | Performance trend — dates correct | Submissions on 3 different dates | GET /api/analytics | performanceTrend entries have date and average | Medium |

---

### Module: AI Agentic Chatbot (Co-Pilot)

| TC-ID | Requirement | Test Title | Preconditions | Test Steps | Expected Result | Priority |
|-------|-------------|-----------|---------------|------------|-----------------|----------|
| TC-CHAT-01 | FR-35 | Student cannot access co-pilot | Student session | POST /api/chat/command | HTTP 403 | Critical |
| TC-CHAT-02 | FR-35 | Co-pilot returns structured response | Instructor session, AI configured | POST with command "list my courses" | Response has message field and data | Critical |
| TC-CHAT-03 | FR-35 | Co-pilot creates chat command record | Instructor session | POST any command | chatCommands record created in DB | High |
| TC-CHAT-04 | FR-35 | Context includes live platform data | Instructor with 2 courses | POST command | AI response references real course names | High |
| TC-CHAT-05 | FR-35 | Conversation memory resolves pronouns | Instructor, recent command created a quiz | POST "publish it" | Co-pilot resolves "it" to the recently created quiz | High |
| TC-CHAT-06 | FR-36 | Create course via co-pilot | Instructor session, AI configured | POST "create a course called Test101" | Course "Test101" created in DB | Critical |
| TC-CHAT-07 | FR-36 | Create quiz with AI questions via co-pilot | Course exists | POST "create a 5-question quiz on photosynthesis in Test101" | Quiz created with 5 AI-generated questions | Critical |
| TC-CHAT-08 | FR-36 | Create assignment via co-pilot | Course exists | POST "create assignment on sorting algorithms due in 2 weeks" | Assignment created with correct due date | High |
| TC-CHAT-09 | FR-36 | Multi-step command executed in sequence | Instructor, no courses | POST "create a course X, add a quiz on Y, publish it" | All 3 actions complete; quiz published | Critical |
| TC-CHAT-10 | FR-37 | Publish quiz via co-pilot | Draft quiz exists | POST "publish [quiz name]" | Quiz status becomes "published" | High |
| TC-CHAT-11 | FR-37 | Publish all drafts via co-pilot | 3 draft quizzes | POST "publish all my draft quizzes" | All 3 quizzes published | High |
| TC-CHAT-12 | FR-37 | Update quiz time limit via co-pilot | Quiz exists | POST "set time limit to 30 minutes on [quiz name]" | timeLimitMinutes=30 updated | High |
| TC-CHAT-13 | FR-38 | List courses via co-pilot | 2 courses exist | POST "list all my courses" | Both courses listed in markdown response | High |
| TC-CHAT-14 | FR-38 | Answer platform question | Instructor | POST "how many students do I have?" | AI answers with correct count from context | High |
| TC-CHAT-15 | FR-38 | List quiz submissions via co-pilot | Quiz has submissions | POST "show results of [quiz name]" | Submission results listed | High |
| TC-CHAT-16 | FR-39 | Enroll student via co-pilot | Student and course exist | POST "enroll [student email] in [course name]" | Enrollment created | High |
| TC-CHAT-17 | FR-39 | Generate public link via co-pilot | Quiz exists and published | POST "generate a public attempt link for [quiz name]" | publicAccessToken created; URL returned | High |
| TC-CHAT-18 | FR-39 | Show student performance via co-pilot | Student has submissions | POST "show performance of [student name]" | Student's results displayed | High |
| TC-CHAT-19 | FR-40 | Navigate via co-pilot | Instructor session | POST "go to gradebook" | navigateTo: "/gradebook" in response data | Medium |
| TC-CHAT-20 | FR-35 | Malformed AI response — fallback | AI returns non-JSON | Any command | Fallback to "question" intent; no 500 error | High |
| TC-CHAT-21 | FR-35 | Unknown intent — handled gracefully | Instructor session | POST "do something impossible" | Graceful message; no crash | Medium |
| TC-CHAT-22 | FR-35 | AI provider unavailable during co-pilot | AI key invalid | POST any command | Descriptive error returned; chatCommand marked failed | High |
| TC-CHAT-23 | FR-36 | Code auto-generated if not specified | Instructor | POST "create course called Statistics" | Course created with auto-generated code (e.g., COURSE123) | Medium |
| TC-CHAT-24 | FR-36 | Due date defaults to +7 days | No due date specified | POST "create assignment on regression" | dueDate is approximately 7 days from now | Medium |
| TC-CHAT-25 | FR-35 | Command marked completed | Instructor, successful command | POST command | chatCommands record updated to status="completed" | High |
| TC-CHAT-26 | FR-35 | Failed command marked failed | AI errors mid-task | Force AI failure | chatCommands record updated to status="failed" | High |

---

### Module: Settings & AI Provider Configuration

| TC-ID | Requirement | Test Title | Preconditions | Test Steps | Expected Result | Priority |
|-------|-------------|-----------|---------------|------------|-----------------|----------|
| TC-SET-01 | FR-41 | Get AI provider settings | Instructor session | GET /api/settings/ai-providers | Returns activeProvider, per-provider masked keys | High |
| TC-SET-02 | FR-41 | API keys masked in response | Instructor has Gemini key set | GET /api/settings/ai-providers | Key shown as "AIza...4f2c" (first 6 + last 4) | Critical |
| TC-SET-03 | FR-41 | Set active provider — valid | Instructor session | PUT /api/settings/ai-providers with activeProvider="openai" | HTTP 200, activeProvider updated | High |
| TC-SET-04 | FR-41 | Set active provider — invalid value | Instructor session | PUT with activeProvider="badprovider" | HTTP 400 with list of valid providers | High |
| TC-SET-05 | FR-41 | Clear API key by sending empty string | Instructor, Gemini key exists | PUT with geminiApiKey="" | Key cleared (null) in DB | High |
| TC-SET-06 | FR-41 | Student cannot access AI provider settings | Student session | GET /api/settings/ai-providers | HTTP 403 | Critical |
| TC-SET-07 | FR-41 | Test valid Gemini key | Instructor, valid Gemini key | POST /api/settings/test-ai-provider with provider="gemini" | valid: true, success message | High |
| TC-SET-08 | FR-41 | Test invalid OpenAI key | Instructor, bad key | POST /api/settings/test-ai-provider with provider="openai" | valid: false, error message | High |
| TC-SET-09 | FR-41 | Custom provider with baseUrl | Instructor | PUT with provider="custom", customApiBaseUrl="http://localhost:11434/v1" | HTTP 200; baseUrl stored | Medium |
| TC-SET-10 | FR-41 | Test custom provider — missing baseUrl | Instructor | Test custom provider with no baseUrl | Defaults to http://localhost:11434/v1 | Low |
| TC-SET-11 | FR-42 | Platform fallback when no user key | Instructor with no keys, platform Gemini set | Trigger AI feature | Uses platform Gemini key; succeeds | High |
| TC-SET-12 | FR-42 | OpenRouter adds required headers | OpenRouter active | Any AI call | HTTP-Referer and X-Title headers present in provider request | Medium |
| TC-SET-13 | FR-42 | Anthropic system message forwarded correctly | Anthropic active | AI call with system message | system field in Anthropic API request body | Medium |

---

### Module: Public Quiz Links

| TC-ID | Requirement | Test Title | Preconditions | Test Steps | Expected Result | Priority |
|-------|-------------|-----------|---------------|------------|-----------------|----------|
| TC-PUB-01 | FR-43 | Generate public link — attempt mode | Instructor, published quiz | POST /api/quizzes/:id/generate-public-link with permission="attempt" | HTTP 200, publicUrl returned, publicLinkEnabled=true | High |
| TC-PUB-02 | FR-43 | Generate public link — view mode | Instructor, published quiz | POST with permission="view" | HTTP 200, view-only link generated | High |
| TC-PUB-03 | FR-43 | Default required fields | No requiredFields specified | POST without requiredFields | Defaults to ["name", "email"] | Medium |
| TC-PUB-04 | FR-43 | Disable public link | Instructor, link active | POST /api/quizzes/:id/disable-public-link | publicLinkEnabled=false, token cleared | High |
| TC-PUB-05 | FR-43 | Non-existent quiz link generation | Instructor | POST with invalid quiz ID | HTTP 404 "Quiz not found" | Medium |
| TC-PUB-06 | FR-44 | Unauthenticated access — valid token | Link enabled | GET /api/public/quiz/:token | HTTP 200, quiz and questions returned | Critical |
| TC-PUB-07 | FR-44 | Correct answers hidden in attempt mode | Attempt-mode link | GET public quiz | correctAnswer and explanation fields absent from questions | Critical |
| TC-PUB-08 | FR-44 | Access disabled token | Link disabled | GET /api/public/quiz/:disabled-token | HTTP 404 | High |
| TC-PUB-09 | FR-44 | Access invalid token | Random string | GET /api/public/quiz/randomstring | HTTP 404 | High |
| TC-PUB-10 | FR-44 | Submit via public link | Attempt-mode link, questions answered | POST /api/public/quiz/:token/submit | HTTP 200, score and percentage returned; passed flag set | Critical |
| TC-PUB-11 | FR-44 | Submit to view-only link rejected | View-mode link | POST submit | HTTP 403 "Quiz submission not allowed" | Critical |
| TC-PUB-12 | FR-44 | IP address stored on public submission | Any | POST submit | submission.ipAddress populated | High |
| TC-PUB-13 | FR-44 | identificationData stored | Submit with name+email | POST submit | identificationData contains submitted name and email | High |
| TC-PUB-14 | FR-44 | Instructor views public submissions | Instructor session, submissions exist | GET /api/quizzes/:id/public-submissions | All public submissions returned | High |
| TC-PUB-15 | FR-44 | Public submission score accuracy | Known correct answers | Submit all correct | score == totalPoints, percentage == 100 | Critical |
| TC-PUB-16 | FR-44 | Public access token not exposed | GET public quiz | Check response | publicAccessToken field is undefined in response | High |

---

### Integration Tests: End-to-End Workflow

| TC-ID | Description | Test Steps | Expected Result | Priority |
|-------|-------------|-----------|-----------------|----------|
| TC-INT-01 | Full quiz lifecycle: create → publish → take → grade → gradebook | 1. Instructor creates quiz. 2. Publishes it. 3. Student takes it. 4. Student submits. 5. Instructor views gradebook. | Grade appears in gradebook for student row. | Critical |
| TC-INT-02 | Full assignment lifecycle: create → publish → submit → AI grade → gradebook | 1. Instructor creates assignment with rubric. 2. Publishes. 3. Student submits text. 4. Instructor AI grades. 5. Instructor views gradebook. | Grade appears in gradebook; AI feedback available. | Critical |
| TC-INT-03 | Proctored quiz end-to-end | 1. Create proctored quiz. 2. Student takes with webcam. 3. Simulate tab switch. 4. Submit quiz. 5. Instructor reviews violations. | Violation recorded and visible in proctoring review. | Critical |
| TC-INT-04 | Co-pilot creates and publishes quiz; student takes it | 1. Instructor sends co-pilot command to create + publish quiz. 2. Student enrolls. 3. Student takes quiz. 4. Results display correctly. | Full workflow succeeds via co-pilot. | High |
| TC-INT-05 | Public link end-to-end | 1. Instructor publishes quiz and generates public link. 2. Guest accesses link. 3. Guest submits. 4. Instructor views public submissions. | Submission recorded; visible to instructor. | High |
| TC-INT-06 | AI provider switch mid-workflow | 1. Instructor uses Gemini for question generation. 2. Switches to OpenAI. 3. Generates more questions. | Both generation attempts succeed with respective providers. | High |
| TC-INT-07 | Password reset → login → take quiz | 1. Student resets password. 2. Logs in with new password. 3. Takes available quiz. | All steps succeed without errors. | High |
| TC-INT-08 | CSV course import → enroll students → publish quiz → gradebook | 1. Import 5 courses via CSV. 2. Enroll 3 students in one course. 3. Create and publish quiz. 4. Students take quiz. 5. View gradebook. | Gradebook shows 3 students with scores. | High |
| TC-INT-09 | Bulk AI assignment grading | 1. Create assignment. 2. Enroll 5 students. 3. All students submit. 4. Instructor triggers bulk AI grade. | All 5 submissions graded; scores and feedback populated. | High |
| TC-INT-10 | Analytics accuracy cross-check | 1. 3 students complete quiz with scores 50/70/90. 2. View analytics. | averageScore=70, topPerformer=90-scorer, lowPerformer=50-scorer. | High |

---

### Boundary & Edge Case Tests

| TC-ID | Description | Test Steps | Expected Result | Priority |
|-------|-------------|-----------|-----------------|----------|
| TC-EDGE-01 | Quiz with 0 questions | Create quiz with no questions, student attempts | UI handles gracefully; no divide-by-zero on grade | High |
| TC-EDGE-02 | Assignment with no rubric | AI grade assignment without rubric | AI generates general feedback; no crash | High |
| TC-EDGE-03 | Very long quiz title (1000 chars) | Create quiz with 1000-char title | Stored and retrieved correctly (DB text field) | Low |
| TC-EDGE-04 | Very long assignment submission (100KB text) | Student submits 100KB text | Stored and retrievable; grading works | Medium |
| TC-EDGE-05 | Special characters in course name | Create course with "Äëîõü & <Symbols>" | Stored correctly; displayed correctly in UI | Medium |
| TC-EDGE-06 | Simultaneous quiz submissions | Two students submit same quiz at same time | Both submissions created independently with correct scores | High |
| TC-EDGE-07 | Gradebook with 200 students | 200 enrolled students all with submissions | Gradebook loads within NFR-01 timing; CSV exports correctly | High |
| TC-EDGE-08 | AI response with trailing whitespace | AI returns JSON with whitespace | Regex match handles whitespace; JSON parsed correctly | Medium |
| TC-EDGE-09 | Co-pilot command with no courses | Instructor with no courses issues create_quiz | Graceful "No courses found, create a course first" message | High |
| TC-EDGE-10 | Pattern with exactly 4 dots (minimum) | PUT /api/settings/pattern with pattern=[0,1,2,3] | HTTP 200, pattern accepted | High |
| TC-EDGE-11 | Pattern with 9 dots (maximum) | PUT with all 9 dots | HTTP 200, pattern accepted | Medium |
| TC-EDGE-12 | Quiz submission with no answers | Student submits empty answers array | score=0, percentage=0; no crash | High |
| TC-EDGE-13 | Unenroll student not enrolled | POST unenroll for non-enrolled student | Graceful message or 404 | Medium |
| TC-EDGE-14 | Co-pilot handles emoji in command | POST command with emoji "Create 🧪 quiz" | Command processed; emoji in title preserved | Low |
| TC-EDGE-15 | CSV import with BOM (byte-order mark) | Import CSV file with UTF-8 BOM | File parsed correctly; courses created | Low |
| TC-EDGE-16 | Reset password with very long new password (500 chars) | POST reset-password | Accepted and stored (bcrypt hashes any length) | Low |
| TC-EDGE-17 | Analytics for course with 0 students | Empty course | Returns zeros/empty arrays; no crash | High |
| TC-EDGE-18 | Public quiz with 0 questions | Guest accesses public quiz with no questions | Empty questions array returned; no crash | Medium |

---

### Security & Authorization Tests

| TC-ID | Description | Test Steps | Expected Result | Priority |
|-------|-------------|-----------|-----------------|----------|
| TC-SEC-01 | Unauthenticated access to protected routes | No session cookie | GET /api/quizzes, /api/assignments, /api/courses | All return HTTP 401 | Critical |
| TC-SEC-02 | Student access to instructor-only endpoints | Student session | POST /api/quizzes, /api/courses, /api/assignments | HTTP 403 | Critical |
| TC-SEC-03 | Student access to analytics | Student session | GET /api/analytics | HTTP 403 | Critical |
| TC-SEC-04 | Student access to gradebook | Student session | GET /api/gradebook | HTTP 403 | Critical |
| TC-SEC-05 | Student access to AI generation | Student session | POST /api/ai/generate-questions | HTTP 403 | Critical |
| TC-SEC-06 | Student access to chatbot | Student session | POST /api/chat/command | HTTP 403 | Critical |
| TC-SEC-07 | Password not returned in any API response | Any authenticated request | GET /api/auth/me | password field absent | Critical |
| TC-SEC-08 | API keys not returned in plaintext | Instructor with keys set | GET /api/settings/ai-providers | Keys are masked (not plaintext) | Critical |
| TC-SEC-09 | Instructor cannot access other instructor's course data | Instructor A session | GET /api/courses (returns only own) | Instructor B's courses not returned | High |
| TC-SEC-10 | Correct answer hidden from student during quiz | Student takes quiz | GET /api/quiz/:id/take | correctAnswer absent from question objects | Critical |
| TC-SEC-11 | Correct answer hidden from public quiz | Guest accesses attempt-mode public quiz | GET /api/public/quiz/:token | correctAnswer absent | Critical |
| TC-SEC-12 | Session invalidation on logout | Logged in user, then logout | POST /api/auth/logout; then GET /api/auth/me | 401 returned | Critical |
| TC-SEC-13 | SQL injection attempt in username | Login attempt | POST /api/auth/login with username="admin'--" | HTTP 401 (not a SQL error); Drizzle parameterizes queries | Critical |
| TC-SEC-14 | XSS payload stored but escaped | Create course with XSS payload in name | GET course back | Payload stored as text; escaped in HTML output | High |
| TC-SEC-15 | Admin cannot be self-deleted | Admin logged in | DELETE /api/users/:own-id | HTTP 400 | Critical |
| TC-SEC-16 | Rate limiting on login endpoint | Rapid login attempts | 20 POST /api/auth/login in rapid succession | HTTP 429 after threshold (if rate limiter implemented) | High |
| TC-SEC-17 | Non-instructor cannot generate public link | Student session | POST /api/quizzes/:id/generate-public-link | HTTP 403 | High |
| TC-SEC-18 | Public quiz token not exposed in response | GET /api/public/quiz/:token | Check response body | publicAccessToken field is undefined or stripped | High |

---

*End of Document — EduAssess AI SRS & QA Test Cases v1.0*
