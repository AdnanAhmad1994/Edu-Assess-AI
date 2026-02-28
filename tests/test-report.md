# EduAssess AI — Test Report

Generated: 2026-02-22T19:42:56.178Z

## Summary

| Metric | Value |
|---|---|
| Total Tests | 150 |
| ✅ Passed | 150 |
| ❌ Failed | 0 |
| Pass Rate | 100.0% |

## Results by Suite

### Authentication — 25/25 passed

| TC-ID | Title | Status | Details |
|---|---|---|---|
| TC-AUTH-01 | Successful registration | ✅ PASS |  |
| TC-AUTH-01b | Registration returns no password field | ✅ PASS |  |
| TC-AUTH-02 | Duplicate username rejected | ✅ PASS |  |
| TC-AUTH-03 | Duplicate email rejected | ✅ PASS |  |
| TC-AUTH-04 | Short username rejected (< 3 chars) | ✅ PASS |  |
| TC-AUTH-05 | Short password rejected (< 6 chars) | ✅ PASS |  |
| TC-AUTH-06 | Successful login returns 200 | ✅ PASS |  |
| TC-AUTH-06b | Login returns role field | ✅ PASS |  |
| TC-AUTH-07 | Wrong password rejected | ✅ PASS |  |
| TC-AUTH-08 | Non-existent username rejected | ✅ PASS |  |
| TC-AUTH-09 | Empty credentials rejected | ✅ PASS |  |
| TC-AUTH-10 | Session persists after login | ✅ PASS |  |
| TC-AUTH-10b | /api/auth/me has name field | ✅ PASS |  |
| TC-AUTH-11a | Logout returns success | ✅ PASS |  |
| TC-AUTH-11b | After logout session invalid | ✅ PASS |  |
| TC-AUTH-12 | Student blocked from instructor route (POST /api/courses) | ✅ PASS |  |
| TC-AUTH-13 | Unauthenticated request blocked | ✅ PASS |  |
| TC-AUTH-23 | Admin can GET /api/users | ✅ PASS |  |
| TC-AUTH-23b | Users response is array | ✅ PASS |  |
| TC-AUTH-24 | Student blocked from GET /api/users | ✅ PASS |  |
| TC-AUTH-26 | SQL injection in username rejected | ✅ PASS |  |
| TC-AUTH-27 | XSS stored as literal string | ✅ PASS |  |
| TC-AUTH-29 | No password field in /api/auth/me response | ✅ PASS |  |
| TC-AUTH-29b | No raw API keys in /api/auth/me response | ✅ PASS |  |
| TC-AUTH-30 | Instructor blocked from /api/users (admin-only) | ✅ PASS |  |

### Course Management — 16/16 passed

| TC-ID | Title | Status | Details |
|---|---|---|---|
| TC-COURSE-01 | Create course — success | ✅ PASS |  |
| TC-COURSE-01b | Create course — has id | ✅ PASS |  |
| TC-COURSE-02 | Create course — name too short rejected | ✅ PASS |  |
| TC-COURSE-03 | Create course — missing semester rejected | ✅ PASS |  |
| TC-COURSE-04 | Update course — success | ✅ PASS |  |
| TC-COURSE-04b | Update course — name changed | ✅ PASS |  |
| TC-COURSE-06 | Delete course — success | ✅ PASS |  |
| TC-COURSE-09 | Delete non-existent course returns 404 | ✅ PASS |  |
| TC-COURSE-07 | Cascade delete removes quizzes | ✅ PASS |  |
| TC-COURSE-14 | Enroll student by email — success | ✅ PASS |  |
| TC-COURSE-15 | Duplicate enrollment handled gracefully | ✅ PASS |  |
| TC-COURSE-17 | Student sees enrolled course in list | ✅ PASS |  |
| TC-COURSE-16 | Enroll non-existent email returns 404 | ✅ PASS |  |
| TC-COURSE-18 | Instructor GET /api/courses returns array | ✅ PASS |  |
| TC-COURSE-19 | Admin sees all courses | ✅ PASS |  |
| TC-COURSE-19b | Admin courses list has entries | ✅ PASS |  |

### Quiz Management — 14/14 passed

| TC-ID | Title | Status | Details |
|---|---|---|---|
| TC-QUIZ-01 | Create quiz — success (201) | ✅ PASS |  |
| TC-QUIZ-01b | Create quiz — has id | ✅ PASS |  |
| TC-QUIZ-02 | Add MCQ question to quiz — success | ✅ PASS |  |
| TC-QUIZ-04 | Add True/False question — success | ✅ PASS |  |
| TC-QUIZ-05 | Publish quiz — success | ✅ PASS |  |
| TC-QUIZ-05b | Published quiz has status=published | ✅ PASS |  |
| TC-QUIZ-06 | Unpublish quiz (set to draft) — success | ✅ PASS |  |
| TC-QUIZ-08 | Student cannot see draft quiz (403 or 404) | ✅ PASS |  |
| TC-QUIZ-11 | Student submits quiz — success | ✅ PASS |  |
| TC-QUIZ-13 | MCQ auto-scoring — correct answer gets points | ✅ PASS |  |
| TC-QUIZ-16 | Take endpoint does not expose correctAnswer | ✅ PASS |  |
| TC-QUIZ-17 | Generate public link — success | ✅ PASS |  |
| TC-QUIZ-20 | Delete quiz — success | ✅ PASS |  |
| TC-QUIZ-21 | Edit quiz title — success | ✅ PASS |  |

### Assignment Management — 9/9 passed

| TC-ID | Title | Status | Details |
|---|---|---|---|
| TC-ASSIGN-01 | Create assignment — success | ✅ PASS |  |
| TC-ASSIGN-02 | Create assignment — missing maxScore rejected | ✅ PASS |  |
| TC-ASSIGN-03 | Publish assignment — success | ✅ PASS |  |
| TC-ASSIGN-03b | Published assignment has correct status | ✅ PASS |  |
| TC-ASSIGN-05 | Student submits assignment — success | ✅ PASS |  |
| TC-ASSIGN-15 | Double submission prevented | ✅ PASS |  |
| TC-ASSIGN-12 | Delete assignment — success | ✅ PASS |  |
| TC-ASSIGN-13 | Update assignment due date — success | ✅ PASS |  |
| TC-ASSIGN-16 | Empty content submission handled | ✅ PASS |  |

### AI Generation — 7/7 passed

| TC-ID | Title | Status | Details |
|---|---|---|---|
| TC-AI-01 | AI generate questions from text — returns 200 | ✅ PASS |  |
| TC-AI-01b | AI generate questions — returns array | ✅ PASS |  |
| TC-AI-04 | generate_questions without explicit topic — no 'undefined' in message | ✅ PASS |  |
| TC-AI-06 | AI generation with empty topic — handled gracefully (no 500 crash) | ✅ PASS |  |
| TC-AI-19 | Test valid OpenRouter AI key — 200 or valid response | ✅ PASS |  |
| TC-AI-20 | Test invalid AI key — returns error response | ✅ PASS |  |
| TC-AI-20b | Invalid key test response indicates failure | ✅ PASS |  |

### AI Co-Pilot — 21/21 passed

| TC-ID | Title | Status | Details |
|---|---|---|---|
| TC-CHAT-01 | Co-Pilot: simple course creation | ✅ PASS |  |
| TC-CHAT-01b | Co-Pilot: course creation succeeded in result | ✅ PASS |  |
| TC-CHAT-03 | Co-Pilot: full chain (course+quiz+publish+link) | ✅ PASS |  |
| TC-CHAT-03b | Co-Pilot chain has multiple tasks | ✅ PASS |  |
| TC-CHAT-04 | Co-Pilot: update quiz time limit | ✅ PASS |  |
| TC-CHAT-06 | Co-Pilot: publish all drafts | ✅ PASS |  |
| TC-CHAT-07 | Co-Pilot: list all quizzes | ✅ PASS |  |
| TC-CHAT-07b | Co-Pilot list response has message | ✅ PASS |  |
| TC-CHAT-09 | Co-Pilot: conversation follow-up ('that quiz') resolves | ✅ PASS |  |
| TC-CHAT-09b | Co-Pilot: follow-up gives a coherent answer | ✅ PASS |  |
| TC-CHAT-11 | Co-Pilot: free-form question answering | ✅ PASS |  |
| TC-CHAT-11b | Co-Pilot: question answer contains a number | ✅ PASS |  |
| TC-CHAT-15 | Co-Pilot: generate_questions extracts topic correctly | ✅ PASS |  |
| TC-CHAT-15b | Co-Pilot: no 'undefined' in generate_questions response | ✅ PASS |  |
| TC-CHAT-16 | Co-Pilot: unknown intent — no crash, graceful response | ✅ PASS |  |
| TC-CHAT-20 | Co-Pilot: navigate to page | ✅ PASS |  |
| TC-CHAT-20b | Co-Pilot: navigation sets navigateTo | ✅ PASS |  |
| TC-CHAT-22 | Chat command recorded in history | ✅ PASS |  |
| TC-CHAT-22b | Chat history is non-empty array | ✅ PASS |  |
| TC-CHAT-24 | Student blocked from Co-Pilot endpoint | ✅ PASS |  |
| TC-CHAT-15c | Empty chat command handled gracefully | ✅ PASS |  |

### Proctoring — 4/4 passed

| TC-ID | Title | Status | Details |
|---|---|---|---|
| TC-PROC-10 | Non-proctored quiz created successfully (proctored=false) | ✅ PASS |  |
| TC-PROC-10b | Non-proctored quiz has proctored=false | ✅ PASS |  |
| TC-PROC-09 | Proctored quiz has violationThreshold=3 | ✅ PASS |  |
| TC-PROC-09b | Proctored quiz has proctored=true | ✅ PASS |  |

### Grading & Gradebook — 6/6 passed

| TC-ID | Title | Status | Details |
|---|---|---|---|
| TC-GRADE-01 | Gradebook matrix endpoint responds | ✅ PASS |  |
| TC-GRADE-01b | Gradebook response has expected structure | ✅ PASS |  |
| TC-GRADE-04 | Gradebook CSV export endpoint responds | ✅ PASS |  |
| TC-GRADE-07 | Student can access gradebook without error | ✅ PASS |  |
| TC-GRADE-08 | Bulk AI grade all endpoint responds | ✅ PASS |  |
| TC-GRADE-10 | Courses list accessible (for gradebook navigation) | ✅ PASS |  |

### Analytics — 11/11 passed

| TC-ID | Title | Status | Details |
|---|---|---|---|
| TC-ANAL-01 | Dashboard stats endpoint returns 200 | ✅ PASS |  |
| TC-ANAL-01b | Stats has totalCourses field | ✅ PASS |  |
| TC-ANAL-01c | Stats has totalStudents field | ✅ PASS |  |
| TC-ANAL-01d | Stats has pendingGrading field | ✅ PASS |  |
| TC-ANAL-02 | All stat fields are numeric | ✅ PASS |  |
| TC-ANAL-03 | Stats endpoint blocked for unauthenticated | ✅ PASS |  |
| TC-ANAL-04 | Student can access their dashboard stats | ✅ PASS |  |
| TC-ANAL-05 | Stats has recentSubmissions field | ✅ PASS |  |
| TC-ANAL-06 | Gradebook endpoint accessible for instructor | ✅ PASS |  |
| TC-ANAL-07 | Student profile endpoint accessible | ✅ PASS |  |
| TC-ANAL-08 | Submission count is non-negative integer | ✅ PASS |  |

### Public Quiz — 10/10 passed

| TC-ID | Title | Status | Details |
|---|---|---|---|
| TC-PUB-01 | Public link token generated | ✅ PASS |  |
| TC-PUB-03 | Access public quiz with valid token — 200 | ✅ PASS |  |
| TC-PUB-03b | Public quiz has questions | ✅ PASS |  |
| TC-PUB-03c | Public quiz does not expose correctAnswer | ✅ PASS |  |
| TC-PUB-04 | Invalid public token returns 404 | ✅ PASS |  |
| TC-PUB-05 | Submit public quiz — success | ✅ PASS |  |
| TC-PUB-08 | Public quiz submission score calculated | ✅ PASS |  |
| TC-PUB-06 | Public submit without name — rejected | ✅ PASS |  |
| TC-PUB-07 | Instructor can query quiz submissions | ✅ PASS |  |
| TC-PUB-02 | Generate public link for draft quiz — handled | ✅ PASS |  |

### Security & Authorization — 15/15 passed

| TC-ID | Title | Status | Details |
|---|---|---|---|
| TC-SEC-01 | SQL injection in login username — rejected | ✅ PASS |  |
| TC-SEC-02 | SQL injection in course name — stored or rejected safely | ✅ PASS |  |
| TC-SEC-02b | Course table intact after SQL injection attempt | ✅ PASS |  |
| TC-SEC-04 | No raw API key in /api/auth/me response | ✅ PASS |  |
| TC-SEC-04b | No geminiApiKey in /api/auth/me response | ✅ PASS |  |
| TC-SEC-04c | hasOpenrouterKey boolean present instead | ✅ PASS |  |
| TC-SEC-05 | Quiz questions do not expose correctAnswer in take/public endpoint | ✅ PASS |  |
| TC-SEC-07 | Instructor cannot delete another instructor's course | ✅ PASS |  |
| TC-SEC-08 | POST without session cookie → 401/403 | ✅ PASS |  |
| TC-SEC-11 | Co-Pilot ignores destructive SQL in natural language | ✅ PASS |  |
| TC-SEC-11b | Users table intact after destructive chat command | ✅ PASS |  |
| TC-SEC-13 | Student blocked from /api/users (admin-only) | ✅ PASS |  |
| TC-SEC-15 | AI provider settings endpoint returns 200 | ✅ PASS |  |
| TC-SEC-15b | Full API key not exposed in settings response | ✅ PASS |  |
| TC-SEC-18 | Fake/expired reset token rejected | ✅ PASS |  |

### Edge Cases — 12/12 passed

| TC-ID | Title | Status | Details |
|---|---|---|---|
| TC-EDGE-06 | Course name with special chars (C++ & Java) — accepted | ✅ PASS |  |
| TC-EDGE-06b | Special char name stored correctly | ✅ PASS |  |
| TC-EDGE-01 | Zero-question quiz created in draft | ✅ PASS |  |
| TC-EDGE-05 | Gradebook for empty course — no crash | ✅ PASS |  |
| TC-EDGE-09 | 9-dot pattern lock accepted (max) | ✅ PASS |  |
| TC-EDGE-11 | 3-dot pattern rejected (< 4 minimum) | ✅ PASS |  |
| TC-EDGE-12 | AI generation with numQuestions=0 — handled | ✅ PASS |  |
| TC-EDGE-15 | Empty Co-Pilot command — handled gracefully (no 500) | ✅ PASS |  |
| TC-EDGE-16 | Double delete returns 404 | ✅ PASS |  |
| TC-EDGE-18 | Unicode content in submission — stored successfully | ✅ PASS |  |
| TC-EDGE-18b | Unicode content preserved in storage | ✅ PASS |  |
| TC-EDGE-08 | 255-char quiz title — stored or rejected gracefully (no crash) | ✅ PASS |  |

## Failed Tests (Action Required)

🎉 All tests passed!

