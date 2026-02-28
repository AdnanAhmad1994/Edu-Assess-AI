/**
 * EduAssess AI — Test Orchestrator
 * Runs all 5 chunks sequentially and generates the final report.
 */
const { allResults, generateReport } = require("./runner.cjs");
const { runChunk1 } = require("./chunk1-auth-course.cjs");
const { runChunk2 } = require("./chunk2-quiz-assignment.cjs");
const { runChunk3 } = require("./chunk3-ai-chatbot.cjs");
const { runChunk4 } = require("./chunk4-proctoring-gradebook-analytics.cjs");
const { runChunk5 } = require("./chunk5-public-security-edge.cjs");

async function main() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║   EduAssess AI — Full Test Suite Runner   ║");
  console.log("╚═══════════════════════════════════════════╝\n");

  let ctx = {};

  try {
    console.log("\n▶ Running Chunk 1: Auth + Course Management...");
    ctx = await runChunk1();
  } catch (e) {
    console.error("❌ Chunk 1 crashed:", e.message);
  }

  try {
    console.log("\n▶ Running Chunk 2: Quiz + Assignment Management...");
    const ctx2 = await runChunk2(ctx);
    ctx = { ...ctx, ...ctx2 };
  } catch (e) {
    console.error("❌ Chunk 2 crashed:", e.message);
  }

  try {
    console.log("\n▶ Running Chunk 3: AI Generation + Co-Pilot...");
    const ctx3 = await runChunk3(ctx);
    ctx = { ...ctx, ...ctx3 };
  } catch (e) {
    console.error("❌ Chunk 3 crashed:", e.message);
  }

  try {
    console.log("\n▶ Running Chunk 4: Proctoring + Gradebook + Analytics...");
    const ctx4 = await runChunk4(ctx);
    ctx = { ...ctx, ...ctx4 };
  } catch (e) {
    console.error("❌ Chunk 4 crashed:", e.message);
  }

  try {
    console.log("\n▶ Running Chunk 5: Public Quiz + Security + Edge Cases...");
    await runChunk5(ctx);
  } catch (e) {
    console.error("❌ Chunk 5 crashed:", e.message);
  }

  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║              FINAL REPORT                 ║");
  console.log("╚═══════════════════════════════════════════╝");
  const report = generateReport();
  console.log(`\n✅ Passed: ${report.passed}/${report.total} (${report.pct}%)`);
  console.log(`❌ Failed: ${report.failed}/${report.total}`);
}

main().catch(console.error);
