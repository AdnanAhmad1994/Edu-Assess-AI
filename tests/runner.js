/**
 * EduAssess AI — Smart Chunked Test Runner
 * Runs test suites against the live server in chunks,
 * tracks results, and writes a final Markdown report.
 */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://127.0.0.1:5000";
const REPORT_PATH = path.join(__dirname, "test-report.md");
const JSON_PATH = path.join(__dirname, "test-results.json");

// ── HTTP helper ────────────────────────────────────────────────────────────────
function request(method, urlPath, body, cookie, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "127.0.0.1",
      port: 5000,
      path: urlPath,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let data = "";
      const setCookie = res.headers["set-cookie"];
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, cookie: setCookie });
      });
    });
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message }, cookie: null }));
    const timer = setTimeout(() => { req.destroy(); resolve({ status: 0, body: { error: "TIMEOUT" }, cookie: null }); }, timeoutMs);
    req.on("close", () => clearTimeout(timer));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Session helper ─────────────────────────────────────────────────────────────
function extractCookie(setCookieArr) {
  if (!setCookieArr || !setCookieArr.length) return null;
  return setCookieArr[0].split(";")[0];
}

async function login(username = "admin", password = "admin123") {
  const res = await request("POST", "/api/auth/login", { username, password });
  return { cookie: extractCookie(res.cookie), user: res.body, status: res.status };
}

// ── Result tracking ────────────────────────────────────────────────────────────
const allResults = [];

function record(id, title, suite, passed, actual, expected, note = "") {
  const result = { id, title, suite, passed, actual, expected, note };
  allResults.push(result);
  const icon = passed ? "✅" : "❌";
  const short = String(actual).substring(0, 80);
  console.log(`  ${icon} [${id}] ${title}`);
  if (!passed) console.log(`      Expected: ${expected} | Got: ${short}${note ? " | " + note : ""}`);
  return result;
}

// ── Assertion helpers ──────────────────────────────────────────────────────────
function expect(id, title, suite) {
  return {
    statusToBe(res, code, note) {
      const ok = res.status === code;
      return record(id, title, suite, ok, res.status, code, note);
    },
    statusIn(res, codes, note) {
      const ok = codes.includes(res.status);
      return record(id, title, suite, ok, res.status, codes.join(" or "), note);
    },
    bodyHas(res, field, note) {
      const ok = res.body && res.body[field] !== undefined;
      return record(id, title, suite, ok, Object.keys(res.body || {}).join(","), `has field: ${field}`, note);
    },
    bodyFieldEquals(res, field, val, note) {
      const actual = res.body?.[field];
      const ok = actual === val;
      return record(id, title, suite, ok, `${field}=${actual}`, `${field}=${val}`, note);
    },
    bodyNotHas(res, field, note) {
      const ok = !res.body || res.body[field] === undefined;
      return record(id, title, suite, ok, Object.keys(res.body || {}).join(","), `no field: ${field}`, note);
    },
    arrayLength(res, minLen, note) {
      const arr = Array.isArray(res.body) ? res.body : [];
      const ok = arr.length >= minLen;
      return record(id, title, suite, ok, arr.length, `>= ${minLen}`, note);
    },
    bodyContains(res, substr, note) {
      const str = JSON.stringify(res.body || "");
      const ok = str.includes(substr);
      return record(id, title, suite, ok, str.substring(0, 60), `contains: ${substr}`, note);
    },
    bodyNotContains(res, substr, note) {
      const str = JSON.stringify(res.body || "");
      const ok = !str.includes(substr);
      return record(id, title, suite, ok, str.substring(0, 60), `not contains: ${substr}`, note);
    },
    pass(note) {
      return record(id, title, suite, true, "manual-pass", "manual-pass", note);
    },
    fail(actual, expected, note) {
      return record(id, title, suite, false, actual, expected, note);
    },
  };
}

// ── Report generator ───────────────────────────────────────────────────────────
function generateReport() {
  const passed = allResults.filter((r) => r.passed);
  const failed = allResults.filter((r) => !r.passed);
  const total = allResults.length;
  const pct = total > 0 ? ((passed.length / total) * 100).toFixed(1) : 0;

  // Group by suite
  const bySuite = {};
  for (const r of allResults) {
    if (!bySuite[r.suite]) bySuite[r.suite] = [];
    bySuite[r.suite].push(r);
  }

  let md = `# EduAssess AI — Test Report\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n|---|---|\n`;
  md += `| Total Tests | ${total} |\n`;
  md += `| ✅ Passed | ${passed.length} |\n`;
  md += `| ❌ Failed | ${failed.length} |\n`;
  md += `| Pass Rate | ${pct}% |\n\n`;

  md += `## Results by Suite\n\n`;
  for (const [suite, results] of Object.entries(bySuite)) {
    const sp = results.filter((r) => r.passed).length;
    const sf = results.length - sp;
    md += `### ${suite} — ${sp}/${results.length} passed\n\n`;
    md += `| TC-ID | Title | Status | Details |\n|---|---|---|---|\n`;
    for (const r of results) {
      const st = r.passed ? "✅ PASS" : "❌ FAIL";
      const detail = r.passed ? "" : `Expected: \`${r.expected}\` Got: \`${String(r.actual).substring(0,60)}\``;
      md += `| ${r.id} | ${r.title} | ${st} | ${detail} |\n`;
    }
    md += "\n";
  }

  md += `## Failed Tests (Action Required)\n\n`;
  if (failed.length === 0) {
    md += `🎉 All tests passed!\n\n`;
  } else {
    md += `| TC-ID | Suite | Title | Expected | Got |\n|---|---|---|---|---|\n`;
    for (const r of failed) {
      md += `| ${r.id} | ${r.suite} | ${r.title} | ${r.expected} | ${String(r.actual).substring(0,60)} |\n`;
    }
  }

  fs.writeFileSync(REPORT_PATH, md, "utf8");
  fs.writeFileSync(JSON_PATH, JSON.stringify(allResults, null, 2), "utf8");
  console.log(`\n📄 Report saved to: ${REPORT_PATH}`);
  return { total, passed: passed.length, failed: failed.length, pct };
}

module.exports = { request, login, extractCookie, record, expect, generateReport, allResults };
