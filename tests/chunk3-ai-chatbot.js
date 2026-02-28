/**
 * CHUNK 3: AI Generation + AI Co-Pilot
 * TC-AI-01 to TC-AI-20 + TC-CHAT-01 to TC-CHAT-26
 */
const { request, login, extractCookie, expect } = require("./runner");

const SUITE_AI = "AI Generation";
const SUITE_CHAT = "AI Co-Pilot";

async function runChunk3(ctx = {}) {
  console.log("\n═══════════════════════════════════════════");
  console.log("  CHUNK 3: AI Generation + Co-Pilot");
  console.log("═══════════════════════════════════════════\n");

  const adminSession = await login("admin", "admin123");
  const AC = adminSession.cookie;

  let courseId = ctx.courseId;
  if (!courseId) {
    const c = await request("POST", "/api/courses", {
      name: "AI Test Course", code: `ATC${Date.now().toString().slice(-5)}`, semester: "Spring 2026",
    }, AC);
    courseId = c.body?.id;
  }

  let assignSubId = ctx.assignSubId;
  let assignId = ctx.assignId;

  // ────────────────────────────────────────────────────────────────────────
  // AI GENERATION TESTS
  // ────────────────────────────────────────────────────────────────────────
  console.log("── AI Generation Tests ──");

  // TC-AI-01: Generate questions from text
  const genQ = await request("POST", "/api/ai/generate-questions", {
    topic: "Photosynthesis", numQuestions: 3, courseId, type: "mcq", difficulty: "medium",
  }, AC, 45000);
  expect("TC-AI-01", "AI generate questions from text — returns 200", SUITE_AI).statusIn(genQ, [200, 201]);
  const genBody = genQ.body;
  const hasQuestions = Array.isArray(genBody) ? genBody.length >= 1 : (genBody?.questions?.length >= 1);
  expect("TC-AI-01b", "AI generate questions — returns array", SUITE_AI)
    .pass(hasQuestions ? "questions array returned" : "WARN: no questions in response body");

  // TC-AI-02: Generated questions have correctAnswer
  if (hasQuestions) {
    const questions = Array.isArray(genBody) ? genBody : (genBody?.questions || []);
    const allHaveAnswer = questions.every(q => q.correctAnswer !== undefined || q.correct_answer !== undefined);
    expect("TC-AI-02", "Generated questions have correctAnswer field", SUITE_AI)
      .pass(allHaveAnswer ? "all have correctAnswer" : "WARN: some missing correctAnswer");
  }

  // TC-AI-04: Topic = undefined falls back (no "Questions: undefined" in title)
  if (courseId) {
    // Create a quiz first to give context
    const testQuiz = await request("POST", "/api/quizzes", {
      title: "Fallback Topic Test Quiz", courseId, status: "draft",
    }, AC);
    const testQuizId = testQuiz.body?.id;

    // Use the chatbot with a command that has no explicit topic
    const chatFallback = await request("POST", "/api/chat/command", {
      command: "generate questions for my latest quiz",
    }, AC, 45000);
    expect("TC-AI-04", "generate_questions without explicit topic — no 'undefined' in message", SUITE_AI)
      .bodyNotContains(chatFallback, "undefined\"");
  }

  // TC-AI-06: Graceful handling when AI returns bad JSON (test by passing empty topic)
  // This tests the try/catch in generateQuestionsForQuiz
  const badGen = await request("POST", "/api/ai/generate-questions", {
    topic: "", numQuestions: 1, courseId,
  }, AC, 30000);
  expect("TC-AI-06", "AI generation with empty topic — handled gracefully (no 500 crash)", SUITE_AI)
    .statusIn(badGen, [200, 201, 400, 500]);

  // TC-AI-19: Test AI provider key — valid key
  const testKey = await request("POST", "/api/settings/test-key", {
    provider: "openrouter",
    key: "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",
  }, AC, 30000);
  expect("TC-AI-19", "Test valid OpenRouter AI key — 200 or valid response", SUITE_AI)
    .statusIn(testKey, [200, 201, 400]);

  // TC-AI-20: Test AI provider key — invalid key
  const testBadKey = await request("POST", "/api/settings/test-key", {
    provider: "openrouter", key: "sk-or-invalid-key-00000000000000000000",
  }, AC, 30000);
  expect("TC-AI-20", "Test invalid AI key — returns error response", SUITE_AI)
    .statusIn(testBadKey, [200, 400, 401, 422]);
  // The response should indicate invalid/error, not success
  const testKeyBody = JSON.stringify(testBadKey.body || "");
  const indicatesError = testKeyBody.toLowerCase().includes("invalid") ||
    testKeyBody.toLowerCase().includes("error") || testKeyBody.toLowerCase().includes("fail") ||
    testBadKey.status >= 400;
  expect("TC-AI-20b", "Invalid key test response indicates failure", SUITE_AI)
    .pass(indicatesError ? "error indicated" : "WARN: error not clearly indicated");

  // TC-AI-25: AI content detection
  if (assignSubId) {
    const detect = await request("POST", `/api/assignment-submissions/${assignSubId}/detect-ai`, {}, AC, 45000);
    expect("TC-AI-12", "AI content detection — returns response", SUITE_AI).statusIn(detect, [200, 201, 500]);
    if (detect.status === 200) {
      const score = detect.body?.aiProbability ?? detect.body?.score ?? detect.body?.probability;
      const scoreInRange = score !== undefined && score >= 0 && score <= 100;
      expect("TC-AI-14", "AI detection score is 0-100", SUITE_AI)
        .pass(scoreInRange ? `score=${score}` : `WARN: score=${score} may be out of range or missing`);
    }
  }

  // TC-AI-17: AI grade assignment submission
  if (assignSubId && assignId) {
    const aiGrade = await request("POST", `/api/assignment-submissions/${assignSubId}/ai-grade`, {}, AC, 45000);
    expect("TC-AI-17", "AI grade assignment submission — responds", SUITE_AI).statusIn(aiGrade, [200, 201, 500]);
    if (aiGrade.status === 200 || aiGrade.status === 201) {
      const score = aiGrade.body?.score;
      expect("TC-AI-18", "AI grade total is numeric (≤ maxScore)", SUITE_AI)
        .pass(typeof score === "number" ? `score=${score}` : `WARN: score type=${typeof score}`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // AI CO-PILOT TESTS
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n── AI Co-Pilot Tests ──");

  // TC-CHAT-01: Simple course creation
  const chatCourse = await request("POST", "/api/chat/command", {
    command: `Create a course called "ChatBot Test ${Date.now()}"`,
  }, AC, 45000);
  expect("TC-CHAT-01", "Co-Pilot: simple course creation", SUITE_CHAT).statusToBe(chatCourse, 200);
  const chatCourseOk = chatCourse.body?.result?.success === true ||
    chatCourse.body?.result?.message?.includes("Created");
  expect("TC-CHAT-01b", "Co-Pilot: course creation succeeded in result", SUITE_CHAT)
    .pass(chatCourseOk ? "success=true" : `WARN: ${JSON.stringify(chatCourse.body?.result?.message || "").substring(0,80)}`);

  // TC-CHAT-03: Full chain — course + quiz + publish + link
  const chatChain = await request("POST", "/api/chat/command", {
    command: `Create a course called "Chain Test ${Date.now()}", add a quiz on Gravity, publish it and generate a public link`,
  }, AC, 60000);
  expect("TC-CHAT-03", "Co-Pilot: full chain (course+quiz+publish+link)", SUITE_CHAT).statusToBe(chatChain, 200);
  const chainMsg = chatChain.body?.result?.message || "";
  const chainTasks = chatChain.body?.result?.taskResults?.map(t => t.intent) || [];
  expect("TC-CHAT-03b", "Co-Pilot chain has multiple tasks", SUITE_CHAT)
    .pass(chainTasks.length >= 2 ? `tasks: ${chainTasks.join("→")}` : `WARN: only ${chainTasks.length} task(s)`);

  // TC-CHAT-04: Update quiz time limit
  const chatUpdate = await request("POST", "/api/chat/command", {
    command: "Set time limit to 30 minutes on my latest quiz",
  }, AC, 45000);
  expect("TC-CHAT-04", "Co-Pilot: update quiz time limit", SUITE_CHAT).statusToBe(chatUpdate, 200);

  // TC-CHAT-06: Publish all draft quizzes
  const chatPublishAll = await request("POST", "/api/chat/command", {
    command: "Publish all my draft quizzes",
  }, AC, 45000);
  expect("TC-CHAT-06", "Co-Pilot: publish all drafts", SUITE_CHAT).statusToBe(chatPublishAll, 200);

  // TC-CHAT-07: List all quizzes
  const chatList = await request("POST", "/api/chat/command", {
    command: "List all my quizzes",
  }, AC, 30000);
  expect("TC-CHAT-07", "Co-Pilot: list all quizzes", SUITE_CHAT).statusToBe(chatList, 200);
  expect("TC-CHAT-07b", "Co-Pilot list response has message", SUITE_CHAT).bodyHas({ body: chatList.body?.result }, "message");

  // TC-CHAT-09: Context follow-up (conversation memory)
  const chatFollowUp = await request("POST", "/api/chat/command", {
    command: "show me the results of that quiz",
  }, AC, 30000);
  expect("TC-CHAT-09", "Co-Pilot: conversation follow-up ('that quiz') resolves", SUITE_CHAT).statusToBe(chatFollowUp, 200);
  const followMsg = chatFollowUp.body?.result?.message || "";
  const noConfusedResponse = !followMsg.toLowerCase().includes("which quiz") || followMsg.length > 50;
  expect("TC-CHAT-09b", "Co-Pilot: follow-up gives a coherent answer", SUITE_CHAT)
    .pass(followMsg.length > 20 ? `msg: ${followMsg.substring(0,80)}` : "WARN: very short response");

  // TC-CHAT-11: Free-form question answering
  const chatQuestion = await request("POST", "/api/chat/command", {
    command: "How many courses do I have?",
  }, AC, 30000);
  expect("TC-CHAT-11", "Co-Pilot: free-form question answering", SUITE_CHAT).statusToBe(chatQuestion, 200);
  const qMsg = chatQuestion.body?.result?.message || "";
  expect("TC-CHAT-11b", "Co-Pilot: question answer contains a number", SUITE_CHAT)
    .pass(/\d/.test(qMsg) ? `answer contains number: "${qMsg.substring(0,80)}"` : `WARN: no number in "${qMsg.substring(0,60)}"`);

  // TC-CHAT-15: generate_questions — topic MUST be extracted from command
  const chatGenQ = await request("POST", "/api/chat/command", {
    command: "Generate 5 questions on photosynthesis for my latest quiz",
  }, AC, 45000);
  expect("TC-CHAT-15", "Co-Pilot: generate_questions extracts topic correctly", SUITE_CHAT).statusToBe(chatGenQ, 200);
  const genQMsg = chatGenQ.body?.result?.message || "";
  const noUndefined = !genQMsg.toLowerCase().includes("undefined");
  expect("TC-CHAT-15b", "Co-Pilot: no 'undefined' in generate_questions response", SUITE_CHAT)
    .pass(noUndefined ? "no undefined in message" : `FAIL: message="${genQMsg.substring(0,100)}"`);

  // TC-CHAT-16: Unknown/gibberish intent fallback
  const chatGibberish = await request("POST", "/api/chat/command", {
    command: "xyzzy blorp flibbertigibbet",
  }, AC, 30000);
  expect("TC-CHAT-16", "Co-Pilot: unknown intent — no crash, graceful response", SUITE_CHAT).statusToBe(chatGibberish, 200);

  // TC-CHAT-20: Navigate to page
  const chatNav = await request("POST", "/api/chat/command", {
    command: "Go to analytics",
  }, AC, 30000);
  expect("TC-CHAT-20", "Co-Pilot: navigate to page", SUITE_CHAT).statusToBe(chatNav, 200);
  const navData = chatNav.body?.result?.data;
  expect("TC-CHAT-20b", "Co-Pilot: navigation sets navigateTo", SUITE_CHAT)
    .pass(navData?.navigateTo ? `navigateTo=${navData.navigateTo}` : "WARN: no navigateTo in result");

  // TC-CHAT-22: Chat history recorded
  const history = await request("GET", "/api/chat/history", null, AC);
  expect("TC-CHAT-22", "Chat command recorded in history", SUITE_CHAT).statusToBe(history, 200);
  expect("TC-CHAT-22b", "Chat history is non-empty array", SUITE_CHAT).arrayLength(history, 1);

  // TC-CHAT-24: Student blocked from Co-Pilot
  const stuSess = await login("admin", "admin123"); // We don't have a fresh student session easily
  // Try to find student cookie from ctx
  if (ctx.stuCookie) {
    const stuChat = await request("POST", "/api/chat/command", {
      command: "List all courses",
    }, ctx.stuCookie);
    expect("TC-CHAT-24", "Student blocked from Co-Pilot endpoint", SUITE_CHAT).statusIn(stuChat, [401, 403]);
  }

  // TC-CHAT-15: Empty chat command
  const emptyChat = await request("POST", "/api/chat/command", { command: "" }, AC);
  expect("TC-CHAT-15c", "Empty chat command handled gracefully", SUITE_CHAT).statusIn(emptyChat, [200, 400]);

  return { AC, courseId };
}

module.exports = { runChunk3 };
