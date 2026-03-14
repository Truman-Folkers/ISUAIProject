import { getCanvasSyncSnapshot } from "./canvasKnowledge.js";

const MAX_CONTEXT_CHARS = 3200;
const LIMITS = {
  courses: 3,
  instructors: 2,
  tas: 4,
  officeHours: 4,
  assignments: 6,
  announcements: 5,
  fallbackHints: 3,
};

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function dedupeBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function includesQueryTokens(text, queryTokens) {
  const hay = normalizeText(text);
  if (!hay) return false;
  return queryTokens.some((token) => token.length > 2 && hay.includes(token));
}

function scoreCourseMatch(course, queryTokens, queryText) {
  const hay = normalizeText(`${course.courseName || ""} ${course.courseCode || ""}`);
  if (!hay) return 0;
  let score = 0;
  for (const token of queryTokens) {
    if (token.length < 2) continue;
    if (hay.includes(token)) score += 2;
  }
  const numberMatch = queryText.match(/\b\d{3}\b/);
  if (numberMatch && hay.includes(numberMatch[0])) score += 5;
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

function compactCourse(course) {
  return {
    courseId: course.courseId,
    courseName: course.courseName,
    courseCode: course.courseCode,
    courseUrl: course.courseUrl,
  };
}

function compactPerson(person, course) {
  return {
    courseName: course.courseName,
    courseCode: course.courseCode,
    name: person.name,
    email: person.email,
    office: person.office,
    officeHours: (person.officeHours || []).slice(0, 2),
    source: person.source,
  };
}

function compactOfficeHour(entry, course) {
  return {
    courseName: course.courseName,
    courseCode: course.courseCode,
    personName: entry.personName,
    role: entry.role,
    hoursText: entry.hoursText,
    location: entry.location,
    source: entry.source,
  };
}

function compactAssignment(assignment, course) {
  return {
    courseName: course.courseName,
    courseCode: course.courseCode,
    title: assignment.title,
    dueAt: assignment.dueAt,
    url: assignment.url,
    assignmentGroup: assignment.assignmentGroup,
    pointsPossible: assignment.pointsPossible,
    summary: assignment.summary,
  };
}

function compactAnnouncement(announcement, course) {
  return {
    courseName: course.courseName,
    courseCode: course.courseCode,
    title: announcement.title,
    postedAt: announcement.postedAt,
    url: announcement.url,
    summary: announcement.summary,
    importanceScore: announcement.importanceScore,
    isImportant: announcement.isImportant,
  };
}

export function matchRelevantCourses(question, courses = []) {
  const queryText = normalizeText(question);
  const queryTokens = tokenize(question);
  const scored = (courses || [])
    .map((course) => ({ course, score: scoreCourseMatch(course, queryTokens, queryText) }))
    .sort((left, right) => right.score - left.score);

  const matched = scored.filter((entry) => entry.score > 0).map((entry) => entry.course);
  if (matched.length > 0) return matched.slice(0, LIMITS.courses);
  return (courses || []).slice(0, LIMITS.courses);
}

export function filterRelevantPeople(question, courses = []) {
  const q = normalizeText(question);
  const queryTokens = tokenize(question);
  const wantsInstructor = /professor|instructor|lecturer|contact/.test(q);
  const wantsTa = /\bta\b|teaching assistant/.test(q);
  const wantsOfficeHours = /office hour|oh|available|contact/.test(q);

  const instructors = [];
  const tas = [];
  const officeHours = [];

  for (const course of courses) {
    if (wantsInstructor) {
      const people = (course.instructors || []).filter((person) => {
        if (queryTokens.length === 0) return true;
        return includesQueryTokens(`${person.name || ""} ${person.email || ""} ${person.office || ""}`, queryTokens);
      });
      instructors.push(...people.slice(0, LIMITS.instructors).map((person) => compactPerson(person, course)));
    }

    if (wantsTa) {
      const people = (course.tas || []).filter((person) => {
        if (queryTokens.length === 0) return true;
        return includesQueryTokens(`${person.name || ""} ${person.email || ""} ${person.office || ""}`, queryTokens);
      });
      tas.push(...people.slice(0, LIMITS.tas).map((person) => compactPerson(person, course)));
    }

    if (wantsOfficeHours) {
      const entries = (course.officeHours || []).filter((entry) => {
        if (queryTokens.length === 0) return true;
        return includesQueryTokens(`${entry.personName || ""} ${entry.role || ""} ${entry.hoursText || ""} ${entry.location || ""}`, queryTokens);
      });
      officeHours.push(...entries.slice(0, LIMITS.officeHours).map((entry) => compactOfficeHour(entry, course)));
    }
  }

  return {
    instructors: dedupeBy(instructors, (item) => `${item.courseCode || item.courseName}|${item.name || ""}|${item.email || ""}`),
    tas: dedupeBy(tas, (item) => `${item.courseCode || item.courseName}|${item.name || ""}|${item.email || ""}`),
    officeHours: dedupeBy(officeHours, (item) => `${item.courseCode || item.courseName}|${item.personName || item.role || ""}|${item.hoursText || ""}`),
  };
}

export function filterRelevantAssignments(question, courses = []) {
  const q = normalizeText(question);
  const queryTokens = tokenize(question);
  const wantsAssignments = /assignment|due|this week|next week|upcoming|homework|project|quiz|exam/.test(q);
  if (!wantsAssignments) return [];

  const items = [];
  for (const course of courses) {
    for (const assignment of course.assignments || []) {
      const relevantByText = includesQueryTokens(
        `${assignment.title || ""} ${assignment.assignmentGroup || ""} ${assignment.summary || ""} ${(assignment.keyTextLines || []).join(" ")}`,
        queryTokens
      );
      const upcoming = withinNextDays(assignment.dueAt, 7);
      const examLike = Boolean(assignment.isExamLike && /exam|quiz|midterm|final/.test(q));
      const broadDueQuestion = /due|upcoming|this week|next week/.test(q);
      if (!upcoming && !relevantByText && !examLike && !broadDueQuestion) continue;
      items.push(compactAssignment(assignment, course));
    }
  }

  return dedupeBy(
    items
      .sort((left, right) => {
        const leftTime = left.dueAt ? new Date(left.dueAt).getTime() : Number.POSITIVE_INFINITY;
        const rightTime = right.dueAt ? new Date(right.dueAt).getTime() : Number.POSITIVE_INFINITY;
        return leftTime - rightTime;
      })
      .slice(0, LIMITS.assignments),
    (item) => item.url || `${item.courseCode || item.courseName}|${item.title}|${item.dueAt || ""}`
  );
}

export function filterRelevantAnnouncements(question, courses = []) {
  const q = normalizeText(question);
  const queryTokens = tokenize(question);
  const wantsAnnouncements = /announcement|posted|important|update|deadline|office hour|final|midterm|exam/.test(q);
  if (!wantsAnnouncements) return [];

  const items = [];
  for (const course of courses) {
    for (const announcement of course.announcements || []) {
      const relevantByText = includesQueryTokens(
        `${announcement.title || ""} ${announcement.summary || ""} ${announcement.rawText || ""}`,
        queryTokens
      );
      const recent = withinNextDays(announcement.postedAt, 14);
      if (!announcement.isImportant && !relevantByText && !recent && !/announcement|update/.test(q)) continue;
      items.push(compactAnnouncement(announcement, course));
    }
  }

  return dedupeBy(
    items
      .sort((left, right) => {
        const scoreDelta = (right.importanceScore || 0) - (left.importanceScore || 0);
        if (scoreDelta !== 0) return scoreDelta;
        const leftTime = left.postedAt ? new Date(left.postedAt).getTime() : 0;
        const rightTime = right.postedAt ? new Date(right.postedAt).getTime() : 0;
        return rightTime - leftTime;
      })
      .slice(0, LIMITS.announcements),
    (item) => item.url || `${item.courseCode || item.courseName}|${item.title}|${item.postedAt || ""}`
  );
}

function buildFallbackHints(question, courses = []) {
  const q = normalizeText(question);
  const hints = [];
  if (!/syllabus|policy|late work|attendance|grading|office hour/.test(q)) return hints;

  for (const course of courses) {
    const policies = course.policies || {};
    for (const snippet of [...(policies.lateWork || []), ...(policies.attendance || []), ...(policies.grading || [])].slice(0, 2)) {
      hints.push({ courseName: course.courseName, courseCode: course.courseCode, text: snippet });
      if (hints.length >= LIMITS.fallbackHints) return hints;
    }
  }

  return hints;
}

export function buildMinimalCanvasContext(question, canvasSnapshot) {
  const snapshot = canvasSnapshot || {};
  const courses = Array.isArray(snapshot.courses) ? snapshot.courses : [];
  if (courses.length === 0) {
    return {
      hasData: false,
      hasRelevant: false,
      syncedAt: snapshot.syncedAt || null,
      matchedCourses: [],
      instructors: [],
      tas: [],
      officeHours: [],
      assignments: [],
      announcements: [],
      fallbackHints: [],
    };
  }

  const matchedCourses = matchRelevantCourses(question, courses);
  const people = filterRelevantPeople(question, matchedCourses);
  const assignments = filterRelevantAssignments(question, matchedCourses);
  const announcements = filterRelevantAnnouncements(question, matchedCourses);
  const fallbackHints = buildFallbackHints(question, matchedCourses);

  const hasRelevant = Boolean(
    matchedCourses.length ||
    people.instructors.length ||
    people.tas.length ||
    people.officeHours.length ||
    assignments.length ||
    announcements.length ||
    fallbackHints.length
  );

  return {
    hasData: true,
    hasRelevant,
    syncedAt: snapshot.syncedAt || null,
    matchedCourses: matchedCourses.map(compactCourse),
    instructors: people.instructors,
    tas: people.tas,
    officeHours: people.officeHours,
    assignments,
    announcements,
    fallbackHints,
  };
}

function pushSection(lines, title, items, formatter) {
  if (!items || items.length === 0) return;
  lines.push(title);
  for (const item of items) {
    lines.push(formatter(item));
  }
  lines.push("");
}

export function serializeCanvasContextForPrompt(minimalContext) {
  if (!minimalContext?.hasData) return "";

  const lines = [
    `Synced At: ${minimalContext.syncedAt || "unknown"}`,
    "",
  ];

  pushSection(lines, "COURSES", minimalContext.matchedCourses, (course) => {
    return `- ${course.courseName}${course.courseCode ? ` (${course.courseCode})` : ""}`;
  });

  pushSection(lines, "INSTRUCTORS", minimalContext.instructors, (person) => {
    return `- ${person.courseName}: ${person.name || "unknown"}; email=${person.email || "unknown"}; office=${person.office || "unknown"}; hours=${(person.officeHours || []).join(" | ") || "unknown"}`;
  });

  pushSection(lines, "TAS", minimalContext.tas, (person) => {
    return `- ${person.courseName}: ${person.name || "unknown"}; email=${person.email || "unknown"}; office=${person.office || "unknown"}; hours=${(person.officeHours || []).join(" | ") || "unknown"}`;
  });

  pushSection(lines, "OFFICE HOURS", minimalContext.officeHours, (entry) => {
    return `- ${entry.courseName}: ${entry.personName || entry.role || "course staff"}; ${entry.hoursText}; location=${entry.location || "unknown"}`;
  });

  pushSection(lines, "ASSIGNMENTS", minimalContext.assignments, (assignment) => {
    const summary = assignment.summary ? `; summary=${assignment.summary}` : "";
    const group = assignment.assignmentGroup ? `; group=${assignment.assignmentGroup}` : "";
    return `- ${assignment.courseName}: ${assignment.title}; due=${assignment.dueAt || "unknown"}${group}${summary}`;
  });

  pushSection(lines, "ANNOUNCEMENTS", minimalContext.announcements, (announcement) => {
    const summary = announcement.summary ? `; summary=${announcement.summary}` : "";
    return `- ${announcement.courseName}: ${announcement.title}; posted=${announcement.postedAt || "unknown"}; important=${announcement.isImportant ? "yes" : "no"}${summary}`;
  });

  pushSection(lines, "FALLBACK HINTS", minimalContext.fallbackHints, (hint) => {
    return `- ${hint.courseName}: ${hint.text}`;
  });

  const serialized = lines.join("\n").trim();
  if (serialized.length <= MAX_CONTEXT_CHARS) return serialized;
  return `${serialized.slice(0, MAX_CONTEXT_CHARS)}\n[Context truncated]`;
}

export async function getRelevantCanvasContext(question, snapshot = null) {
  const data = snapshot || (await getCanvasSyncSnapshot());
  return buildMinimalCanvasContext(question, data);
}

export async function buildMinimalCanvasPromptContext(question, snapshot = null) {
  const minimalContext = await getRelevantCanvasContext(question, snapshot);
  return {
    ...minimalContext,
    contextText: serializeCanvasContextForPrompt(minimalContext),
  };
}
