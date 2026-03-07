const CANVAS_SYNC_STORAGE_KEY = "canvasKnowledgeBase";

const MONTH_DAY_RE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,\s*\d{4})?/i;

const canvasQuestionRe = /(canvas|course|class|syllabus|assignment|quiz|exam|due|announcement|module|late work|attendance|grading|midterm|final)/i;

const storageLocalGet = (keys) =>
  new Promise((resolve) => chrome.storage.local.get(keys, (data) => resolve(data || {})));

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function scoreCourseMatch(course, queryTokens, queryText) {
  const hay = normalizeText(`${course.courseName || ""} ${course.courseCode || ""}`);
  if (!hay) return 0;
  let score = 0;
  for (const t of queryTokens) {
    if (t.length < 2) continue;
    if (hay.includes(t)) score += 2;
  }
  const numMatch = queryText.match(/\b\d{3}\b/);
  if (numMatch && hay.includes(numMatch[0])) score += 4;
  return score;
}

function withinNextDays(iso, days) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  return d >= now && d <= end;
}

function buildStructuredSummary(question, courses) {
  const q = normalizeText(question);
  const lines = [];

  if (/assignment|due|this week|next week/.test(q)) {
    const due = [];
    for (const c of courses) {
      for (const a of c.assignments || []) {
        if (withinNextDays(a.dueAt, 7)) {
          due.push({ course: c.courseName, title: a.title, dueAt: a.dueAt, url: a.url });
        }
      }
    }
    due.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
    for (const item of due.slice(0, 12)) {
      lines.push(`ASSIGNMENT | ${item.course} | ${item.title} | due ${item.dueAt || "unknown"} | ${item.url || ""}`);
    }
  }

  if (/late work|attendance|grading|policy|syllabus/.test(q)) {
    for (const c of courses) {
      const p = c.policies || {};
      for (const s of (p.lateWork || []).slice(0, 5)) lines.push(`POLICY_LATE_WORK | ${c.courseName} | ${s}`);
      for (const s of (p.attendance || []).slice(0, 4)) lines.push(`POLICY_ATTENDANCE | ${c.courseName} | ${s}`);
      for (const s of (p.grading || []).slice(0, 4)) lines.push(`POLICY_GRADING | ${c.courseName} | ${s}`);
      if ((c.syllabusText || "").length > 0 && lines.length < 12) {
        const m = c.syllabusText.match(MONTH_DAY_RE);
        lines.push(`SYLLABUS_HINT | ${c.courseName} | ${m ? m[0] : "Syllabus indexed"}`);
      }
    }
  }

  if (/exam|quiz|midterm|final/.test(q) || /\b\d{3}\b/.test(q)) {
    for (const c of courses) {
      for (const e of (c.exams || []).slice(0, 40)) {
        const hay = normalizeText(`${e.title || ""} ${e.rawText || ""}`);
        if (tokenize(question).some((t) => t.length > 2 && hay.includes(t))) {
          lines.push(`EXAM | ${c.courseName} | ${e.title} | ${e.date || "date unknown"} | ${e.url || ""}`);
        }
      }
    }
  }

  if (lines.length === 0) {
    for (const c of courses.slice(0, 3)) {
      lines.push(`COURSE_INDEXED | ${c.courseName} | assignments=${(c.assignments || []).length} exams=${(c.exams || []).length} announcements=${(c.announcements || []).length}`);
    }
  }

  return lines.slice(0, 30);
}

export function isLikelyCanvasQuestion(question = "") {
  return canvasQuestionRe.test(String(question || ""));
}

export async function getCanvasSyncMetadata() {
  const data = await storageLocalGet([CANVAS_SYNC_STORAGE_KEY]);
  const kb = data[CANVAS_SYNC_STORAGE_KEY] || null;
  if (!kb) return null;
  return {
    syncedAt: kb.syncedAt || null,
    courseCount: kb.courseCount || (kb.courses || []).length,
    failedCount: (kb.failedCourses || []).length,
  };
}

export async function buildCanvasPromptContext(question) {
  const data = await storageLocalGet([CANVAS_SYNC_STORAGE_KEY]);
  const kb = data[CANVAS_SYNC_STORAGE_KEY] || null;
  if (!kb || !Array.isArray(kb.courses) || kb.courses.length === 0) {
    return { hasData: false, hasRelevant: false, contextText: "" };
  }

  const queryText = normalizeText(question);
  const queryTokens = tokenize(question);

  const scored = kb.courses
    .map((course) => ({ course, score: scoreCourseMatch(course, queryTokens, queryText) }))
    .sort((a, b) => b.score - a.score);

  const matchedCourses = scored.filter((x) => x.score > 0).map((x) => x.course);
  const scope = matchedCourses.length > 0 ? matchedCourses.slice(0, 3) : kb.courses.slice(0, 4);

  const summaryLines = buildStructuredSummary(question, scope);
  const contextText = [
    `Synced At: ${kb.syncedAt || "unknown"}`,
    `Indexed Courses: ${kb.courseCount || kb.courses.length}`,
    "",
    ...scope.map((c) => `COURSE | ${c.courseName}${c.courseCode ? ` (${c.courseCode})` : ""}`),
    "",
    ...summaryLines,
  ].join("\n");

  return {
    hasData: true,
    hasRelevant: summaryLines.length > 0,
    contextText,
    syncedAt: kb.syncedAt || null,
    courseCount: kb.courseCount || kb.courses.length,
  };
}
