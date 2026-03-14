/* global chrome */
const CANVAS_SYNC_STORAGE_KEY = "canvasKnowledgeBase";

const MONTH_DAY_RE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,\s*\d{4})?/i;
const canvasQuestionRe = /(canvas|course|class|syllabus|assignment|quiz|exam|due|announcement|module|late work|attendance|grading|midterm|final|professor|instructor|ta|office hour|contact)/i;
const MAX_CONTEXT_LINES = 16;
const MAX_CONTEXT_CHARS = 4200;

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
  for (const token of queryTokens) {
    if (token.length < 2) continue;
    if (hay.includes(token)) score += 2;
  }
  const numMatch = queryText.match(/\b\d{3}\b/);
  if (numMatch && hay.includes(numMatch[0])) score += 4;
  return score;
}

function withinNextDays(iso, days) {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  return date >= now && date <= end;
}

function pushUnique(lines, value, limit = MAX_CONTEXT_LINES) {
  if (!value || lines.includes(value) || lines.length >= limit) return;
  lines.push(value);
}

function includesQueryTokens(text, queryTokens) {
  const hay = normalizeText(text);
  if (!hay) return false;
  return queryTokens.some((token) => token.length > 2 && hay.includes(token));
}

function courseHeader(course) {
  return `COURSE | ${course.courseName}${course.courseCode ? ` (${course.courseCode})` : ""}`;
}

function buildPeopleLines(question, courses, queryTokens) {
  const q = normalizeText(question);
  const lines = [];
  const wantsInstructor = /professor|instructor|lecturer|teach|contact/.test(q);
  const wantsTa = /\bta\b|teaching assistant/.test(q);
  const wantsOfficeHours = /office hour|oh|available|contact/.test(q);
  if (!wantsInstructor && !wantsTa && !wantsOfficeHours) return lines;

  for (const course of courses) {
    if (wantsInstructor) {
      const matches = (course.instructors || []).filter((person) => {
        if (queryTokens.length === 0) return true;
        return includesQueryTokens(`${person.name || ""} ${person.email || ""} ${person.office || ""}`, queryTokens);
      });
      for (const person of matches.slice(0, 2)) {
        pushUnique(lines, `INSTRUCTOR | ${course.courseName} | ${person.name || "unknown"} | ${person.email || "email unknown"} | ${person.office || "office unknown"}`);
      }
    }
    if (wantsTa) {
      const matches = (course.tas || []).filter((person) => {
        if (queryTokens.length === 0) return true;
        return includesQueryTokens(`${person.name || ""} ${person.email || ""} ${person.office || ""}`, queryTokens);
      });
      for (const person of matches.slice(0, 3)) {
        pushUnique(lines, `TA | ${course.courseName} | ${person.name || "unknown"} | ${person.email || "email unknown"} | ${person.office || "office unknown"}`);
      }
    }
    if (wantsOfficeHours) {
      const matches = (course.officeHours || []).filter((entry) => {
        if (queryTokens.length === 0) return true;
        return includesQueryTokens(`${entry.personName || ""} ${entry.role || ""} ${entry.hoursText || ""} ${entry.location || ""}`, queryTokens);
      });
      for (const entry of matches.slice(0, 4)) {
        pushUnique(lines, `OFFICE_HOURS | ${course.courseName} | ${entry.personName || entry.role || "course staff"} | ${entry.hoursText} | ${entry.location || "location unknown"}`);
      }
    }
  }
  return lines;
}

function buildAssignmentLines(question, courses, queryTokens) {
  const q = normalizeText(question);
  const lines = [];
  if (!/assignment|due|this week|next week|upcoming|homework|project|quiz|exam/.test(q)) return lines;

  const due = [];
  for (const course of courses) {
    for (const assignment of course.assignments || []) {
      const relevantByText = includesQueryTokens(
        `${assignment.title || ""} ${assignment.assignmentGroup || ""} ${assignment.summary || ""} ${(assignment.keyTextLines || []).join(" ")}`,
        queryTokens
      );
      const shouldInclude = withinNextDays(assignment.dueAt, 7) || /due|upcoming|next/.test(q) || relevantByText;
      if (!shouldInclude) continue;
      due.push({
        course: course.courseName,
        title: assignment.title,
        dueAt: assignment.dueAt,
        url: assignment.url,
        group: assignment.assignmentGroup,
        summary: assignment.summary,
        missingDueDate: assignment.missingDueDate,
      });
    }
  }

  due.sort((left, right) => {
    const leftTime = left.dueAt ? new Date(left.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const rightTime = right.dueAt ? new Date(right.dueAt).getTime() : Number.POSITIVE_INFINITY;
    return leftTime - rightTime;
  });

  for (const item of due.slice(0, 6)) {
    pushUnique(lines, `ASSIGNMENT | ${item.course} | ${item.title} | due ${item.dueAt || "unknown"} | ${item.group || "uncategorized"}`);
    if (item.summary) pushUnique(lines, `ASSIGNMENT_SUMMARY | ${item.course} | ${item.title} | ${item.summary}`);
  }

  if (lines.length === 0) {
    for (const course of courses) {
      for (const assignment of (course.assignments || []).filter((item) => item.missingDueDate).slice(0, 2)) {
        pushUnique(lines, `ASSIGNMENT_NO_DUE_DATE | ${course.courseName} | ${assignment.title}`);
      }
    }
  }

  return lines;
}

function buildPolicyLines(courses) {
  const lines = [];
  for (const course of courses) {
    const policies = course.policies || {};
    for (const snippet of (policies.lateWork || []).slice(0, 2)) pushUnique(lines, `POLICY_LATE_WORK | ${course.courseName} | ${snippet}`);
    for (const snippet of (policies.attendance || []).slice(0, 2)) pushUnique(lines, `POLICY_ATTENDANCE | ${course.courseName} | ${snippet}`);
    for (const snippet of (policies.grading || []).slice(0, 2)) pushUnique(lines, `POLICY_GRADING | ${course.courseName} | ${snippet}`);
    if ((course.syllabusText || "").length > 0 && lines.length < MAX_CONTEXT_LINES) {
      const match = course.syllabusText.match(MONTH_DAY_RE);
      pushUnique(lines, `SYLLABUS_HINT | ${course.courseName} | ${match ? match[0] : "Syllabus indexed"}`);
    }
  }
  return lines;
}

function buildExamLines(question, courses, queryTokens) {
  const wantsExamData = /exam|quiz|midterm|final/.test(normalizeText(question)) || /\b\d{3}\b/.test(question);
  const lines = [];
  if (!wantsExamData) return lines;

  for (const course of courses) {
    const matches = (course.exams || []).filter((exam) => {
      if (queryTokens.length === 0) return true;
      return includesQueryTokens(`${exam.title || ""} ${exam.rawText || ""}`, queryTokens);
    });
    for (const exam of matches.slice(0, 4)) {
      pushUnique(lines, `EXAM | ${course.courseName} | ${exam.title} | ${exam.date || "date unknown"}`);
    }
  }
  return lines;
}

function buildAnnouncementLines(question, courses, queryTokens) {
  const q = normalizeText(question);
  const wantsAnnouncements = /announcement|posted|important|update|deadline|office hour|final|midterm|exam/.test(q);
  const lines = [];
  if (!wantsAnnouncements) return lines;

  for (const course of courses) {
    const announcements = [...(course.announcements || [])]
      .filter((announcement) => {
        if (announcement.isImportant) return true;
        if (queryTokens.length === 0) return false;
        return includesQueryTokens(`${announcement.title || ""} ${announcement.summary || ""} ${announcement.rawText || ""}`, queryTokens);
      })
      .sort((left, right) => (right.importanceScore || 0) - (left.importanceScore || 0))
      .slice(0, 4);

    for (const announcement of announcements) {
      pushUnique(lines, `ANNOUNCEMENT | ${course.courseName} | ${announcement.title} | ${announcement.postedAt || "unknown"} | important=${announcement.isImportant ? "yes" : "no"}`);
      if (announcement.summary) pushUnique(lines, `ANNOUNCEMENT_SUMMARY | ${course.courseName} | ${announcement.summary}`);
    }
  }

  return lines;
}

function buildStructuredSummary(question, courses) {
  const q = normalizeText(question);
  const queryTokens = tokenize(question);
  const lines = [];

  for (const line of buildPeopleLines(question, courses, queryTokens)) pushUnique(lines, line);
  for (const line of buildAssignmentLines(question, courses, queryTokens)) pushUnique(lines, line);
  if (/late work|attendance|grading|policy|syllabus/.test(q)) {
    for (const line of buildPolicyLines(courses)) pushUnique(lines, line);
  }
  for (const line of buildExamLines(question, courses, queryTokens)) pushUnique(lines, line);
  for (const line of buildAnnouncementLines(question, courses, queryTokens)) pushUnique(lines, line);

  if (lines.length === 0) {
    for (const course of courses.slice(0, 2)) {
      pushUnique(lines, `COURSE_INDEXED | ${course.courseName} | assignments=${(course.assignments || []).length} exams=${(course.exams || []).length} announcements=${(course.announcements || []).length}`);
    }
  }

  return lines.slice(0, MAX_CONTEXT_LINES);
}

function trimContextText(text) {
  const value = String(text || "").trim();
  if (value.length <= MAX_CONTEXT_CHARS) return value;
  return `${value.slice(0, MAX_CONTEXT_CHARS)}\n[Context truncated]`;
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
    .sort((left, right) => right.score - left.score);

  const matchedCourses = scored.filter((entry) => entry.score > 0).map((entry) => entry.course);
  const scope = matchedCourses.length > 0 ? matchedCourses.slice(0, 2) : kb.courses.slice(0, 2);

  const summaryLines = buildStructuredSummary(question, scope);
  const contextText = trimContextText(
    [
      `Synced At: ${kb.syncedAt || "unknown"}`,
      `Indexed Courses: ${kb.courseCount || kb.courses.length}`,
      "",
      ...scope.map((course) => courseHeader(course)),
      "",
      ...summaryLines,
    ].join("\n")
  );

  return {
    hasData: true,
    hasRelevant: summaryLines.length > 0,
    contextText,
    syncedAt: kb.syncedAt || null,
    courseCount: kb.courseCount || kb.courses.length,
  };
}
