/* global chrome */
import {
  dedupeAnnouncements,
  dedupeAssignments,
  dedupeFileLinks,
  dedupeOfficeHours,
  extractInstructorCandidates,
  extractOfficeHourEntries,
  extractPolicies,
  extractTaCandidates,
  normalizeAnnouncement,
  normalizeAssignment,
  normalizePersonRecords,
  normalizeSourceText,
} from "./canvasSyncExtractors.js";

const CANVAS_SYNC_STORAGE_KEY = "canvasKnowledgeBase";
const CANVAS_SYNC_VERSION = 2;

function detectCanvasPageContext(url = window.location.href) {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    const isDashboard = path === "/" || path === "/dashboard";
    const isCourse = /\/courses\/\d+/.test(path);
    const isSyllabus = /\/courses\/\d+\/assignments\/syllabus/.test(path);
    const isAssignments = /\/courses\/\d+\/assignments/.test(path);
    const isModules = /\/courses\/\d+\/modules/.test(path);
    const isAnnouncements = /\/courses\/\d+\/announcements/.test(path) || /\/courses\/\d+\/discussion_topics/.test(path);
    return {
      host: u.host,
      url: u.toString(),
      pathname: u.pathname,
      isCanvas: /canvas/i.test(u.host),
      isDashboard,
      isCourse,
      isSyllabus,
      isAssignments,
      isModules,
      isAnnouncements,
    };
  } catch {
    return {
      host: "",
      url: String(url || ""),
      pathname: "",
      isCanvas: false,
      isDashboard: false,
      isCourse: false,
      isSyllabus: false,
      isAssignments: false,
      isModules: false,
      isAnnouncements: false,
    };
  }
}

const storageLocalGet = (keys) =>
  new Promise((resolve) => chrome.storage.local.get(keys, (data) => resolve(data || {})));

const storageLocalSet = (data) =>
  new Promise((resolve) => chrome.storage.local.set(data, () => resolve(true)));

function sendSyncProgress(stage, detail, extra = {}) {
  chrome.runtime.sendMessage(
    {
      type: "CANVAS_SYNC_PROGRESS",
      stage,
      detail,
      timestamp: new Date().toISOString(),
      ...extra,
    },
    () => {}
  );
}

async function fetchCanvasJson(url) {
  const resp = await fetch(url, { credentials: "include" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
}

async function fetchCanvasText(url) {
  const resp = await fetch(url, { credentials: "include" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.text();
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const text = doc.body?.innerText || "";
  return normalizeSourceText(text);
}

function truncateText(text, max = 6000) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}\n\n[truncated]` : text;
}

function extractPdfLinksFromHtml(html, baseUrl) {
  const links = [];
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  for (const a of doc.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") || "";
    const label = (a.innerText || "").trim();
    if (!href) continue;
    const isPdf = /\.pdf(\?|$)/i.test(href) || /\/files\/\d+/i.test(href);
    if (!isPdf) continue;
    try {
      links.push({
        label: label || "PDF resource",
        url: new URL(href, baseUrl).toString(),
      });
    } catch (error) {
    void error;
  }
  }
  return links;
}

function splitMeaningfulLines(text) {
  return (text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function extractDateSnippet(text) {
  if (!text) return undefined;
  const dateMatch = text.match(
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,\s*\d{4})?(?:\s+\d{1,2}:\d{2}\s*(?:am|pm))?/i
  );
  if (dateMatch) return dateMatch[0];
  const numeric = text.match(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?(?:\s+\d{1,2}:\d{2}\s*(?:am|pm))?/i);
  return numeric ? numeric[0] : undefined;
}

function extractExamLikeItems(text, source, courseUrl) {
  const exams = [];
  for (const line of splitMeaningfulLines(text)) {
    if (!/(exam|quiz|midterm|final)/i.test(line)) continue;
    exams.push({
      title: line.slice(0, 180),
      date: extractDateSnippet(line),
      source,
      url: courseUrl,
      rawText: line.slice(0, 300),
    });
    if (exams.length >= 40) break;
  }
  return exams;
}

function normalizePeoplePageRole(text) {
  const normalized = String(text || "").toLowerCase();
  if (/(student|observer|designer)/.test(normalized)) return undefined;
  if (/(ta|teaching assistant)/.test(normalized)) return "TA";
  if (/(teacher|instructor|professor|lecturer|faculty)/.test(normalized)) return "Instructor";
  return undefined;
}

function extractPeoplePageRecords(html, source) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const records = [];
  const mailtoLinks = Array.from(doc.querySelectorAll("a[href^='mailto:']"));
  for (const link of mailtoLinks) {
    const container = link.closest("li, tr, article, section, div");
    const containerText = normalizeSourceText(container?.innerText || "");
    if (!containerText) continue;

    const headingText = normalizeSourceText(
      container?.closest("section, article, div")?.querySelector("h1, h2, h3, h4")?.innerText || ""
    );
    const role = normalizePeoplePageRole(`${headingText}\n${containerText}`);
    if (!role) continue;

    const lines = splitMeaningfulLines(containerText);
    const email = (link.getAttribute("href") || "").replace(/^mailto:/i, "").trim().toLowerCase() || undefined;
    const name =
      lines.find((line) => line && line !== email && !/@/.test(line) && line.length <= 80 && /^[A-Za-z]/.test(line)) ||
      (link.innerText || "").trim() ||
      undefined;
    const office = lines.find((line) => /\b(?:office|room|building|hall|zoom)\b/i.test(line));
    const officeHours = lines
      .filter((line) => /\b(?:office hours?|oh|mon|tue|wed|thu|fri|sat|sun)\b/i.test(line))
      .slice(0, 3);

    records.push({
      name,
      role,
      email,
      office,
      officeHours,
      source,
      rawText: truncateText(containerText, 1200),
    });
  }
  return records;
}

function collectStructuredPeople(result, seededInstructors = [], seededTas = [], seededOfficeHours = []) {
  const instructorCandidates = [...seededInstructors];
  const taCandidates = [...seededTas];
  const officeHourEntries = [...seededOfficeHours];

  const textSources = [];
  if (result.syllabusText) {
    textSources.push({ source: "syllabus", text: result.syllabusText });
  }
  for (const page of result.rawPages || []) {
    textSources.push({ source: page.type, text: page.text });
  }
  for (const announcement of result.announcements || []) {
    if (!announcement?.rawText) continue;
    const source = announcement.url ? `announcement:${announcement.url}` : `announcement:${announcement.title || "unknown"}`;
    textSources.push({ source, text: `${announcement.title || ""}\n${announcement.rawText}` });
  }

  for (const entry of textSources) {
    instructorCandidates.push(...extractInstructorCandidates(entry.text, entry.source));
    taCandidates.push(...extractTaCandidates(entry.text, entry.source));
    officeHourEntries.push(...extractOfficeHourEntries(entry.text, entry.source));
  }

  const normalizedOfficeHours = dedupeOfficeHours(officeHourEntries);
  const instructors = normalizePersonRecords(instructorCandidates, normalizedOfficeHours);
  const tas = normalizePersonRecords(taCandidates, normalizedOfficeHours);

  const derivedHours = [
    ...instructors.flatMap((person) =>
      (person.officeHours || []).map((hoursText) => ({
        personName: person.name,
        role: person.role,
        hoursText,
        location: person.office,
        source: person.source,
        rawText: person.rawText,
      }))
    ),
    ...tas.flatMap((person) =>
      (person.officeHours || []).map((hoursText) => ({
        personName: person.name,
        role: person.role,
        hoursText,
        location: person.office,
        source: person.source,
        rawText: person.rawText,
      }))
    ),
  ];

  return {
    instructors,
    tas,
    officeHours: dedupeOfficeHours([...normalizedOfficeHours, ...derivedHours]),
  };
}

async function discoverCanvasCourses(fallbackCourseFn) {
  const origin = window.location.origin;
  try {
    const apiCourses = await fetchCanvasJson(
      `${origin}/api/v1/courses?enrollment_state=active&state[]=available&per_page=100`
    );
    const normalized = (Array.isArray(apiCourses) ? apiCourses : [])
      .filter((c) => c?.id)
      .map((c) => ({
        courseId: String(c.id),
        courseName: c.name || c.original_name || `Course ${c.id}`,
        courseCode: c.course_code || undefined,
        courseUrl: `${origin}/courses/${c.id}`,
      }));
    if (normalized.length > 0) return normalized;
  } catch (error) {
    void error;
  }

  return fallbackCourseFn().map((c) => ({
    courseId: String(c.id),
    courseName: c.name,
    courseCode: undefined,
    courseUrl: c.url,
  }));
}

async function syncSingleCanvasCourse(course) {
  const now = new Date();
  const nowIso = now.toISOString();
  const base = course.courseUrl;
  const result = {
    courseId: String(course.courseId),
    courseName: course.courseName,
    courseCode: course.courseCode,
    courseUrl: base,
    scrapedAt: nowIso,
    syllabusText: "",
    assignments: [],
    exams: [],
    announcements: [],
    instructors: [],
    tas: [],
    officeHours: [],
    policies: { lateWork: [], attendance: [], grading: [], other: [] },
    fileLinks: [],
    rawPages: [],
  };

  const id = encodeURIComponent(course.courseId);
  const seededInstructorCandidates = [];
  const seededTaCandidates = [];
  const seededOfficeHourEntries = [];
  let assignmentGroupMap = {};

  sendSyncProgress("indexing_assignments", `Indexing assignments for ${course.courseName}`);
  try {
    const assignmentGroups = await fetchCanvasJson(
      `${window.location.origin}/api/v1/courses/${id}/assignment_groups?per_page=100`
    );
    assignmentGroupMap = Object.fromEntries(
      (Array.isArray(assignmentGroups) ? assignmentGroups : [])
        .filter((group) => group?.id)
        .map((group) => [group.id, group.name || `Group ${group.id}`])
    );
  } catch (error) {
    void error;
  }

  try {
    const assignments = await fetchCanvasJson(`${window.location.origin}/api/v1/courses/${id}/assignments?per_page=100`);
    result.assignments = dedupeAssignments(
      (Array.isArray(assignments) ? assignments : []).map((assignment) =>
        normalizeAssignment(assignment, base, assignmentGroupMap, now)
      )
    );
    result.exams.push(
      ...result.assignments
        .filter((assignment) => assignment.isExamLike)
        .map((assignment) => ({
          title: assignment.title,
          date: assignment.dueAt || extractDateSnippet(`${assignment.summary || ""}\n${assignment.rawText || ""}`),
          source: "assignments",
          url: assignment.url,
          rawText: (assignment.rawText || "").slice(0, 300),
        }))
    );
  } catch (error) {
    void error;
  }

  sendSyncProgress("reading_announcements", `Reading announcements for ${course.courseName}`);
  try {
    const anns = await fetchCanvasJson(
      `${window.location.origin}/api/v1/courses/${id}/discussion_topics?only_announcements=true&per_page=30`
    );
    result.announcements = dedupeAnnouncements(
      (Array.isArray(anns) ? anns : []).map((announcement) => normalizeAnnouncement(announcement, base))
    );
    for (const announcement of result.announcements) {
      result.exams.push(...extractExamLikeItems(`${announcement.title}\n${announcement.rawText || ""}`, "announcements", announcement.url || base));
    }
  } catch (error) {
    void error;
  }

  const htmlSources = [
    { type: "home", url: `${base}` },
    { type: "syllabus", url: `${base}/assignments/syllabus` },
    { type: "people", url: `${base}/users` },
    { type: "assignments_page", url: `${base}/assignments` },
    { type: "modules", url: `${base}/modules` },
    { type: "announcements_page", url: `${base}/announcements` },
  ];

  for (const src of htmlSources) {
    sendSyncProgress("reading_page", `Reading ${src.type.replace("_", " ")} for ${course.courseName}`);
    try {
      const html = await fetchCanvasText(src.url);
      const text = truncateText(htmlToText(html), 7000);
      if (!text) continue;
      result.rawPages.push({ type: src.type, url: src.url, text });
      result.fileLinks.push(...extractPdfLinksFromHtml(html, src.url));
      if (src.type === "syllabus" && text.length > 0) result.syllabusText = text;
      result.exams.push(...extractExamLikeItems(text, src.type, src.url));
      if (src.type === "people") {
        const peopleRecords = extractPeoplePageRecords(html, src.type);
        seededInstructorCandidates.push(...peopleRecords.filter((record) => record.role === "Instructor" || record.role === "Professor" || record.role === "Lecturer"));
        seededTaCandidates.push(...peopleRecords.filter((record) => /ta/i.test(record.role || "")));
        seededOfficeHourEntries.push(
          ...peopleRecords.flatMap((record) =>
            (record.officeHours || []).map((hoursText) => ({
              personName: record.name,
              role: record.role,
              hoursText,
              location: record.office,
              source: src.type,
              rawText: record.rawText,
            }))
          )
        );
      }
    } catch (error) {
    void error;
  }
  }

  if (!result.syllabusText) {
    const syllabusPage = result.rawPages.find((p) => p.type === "syllabus");
    if (syllabusPage) result.syllabusText = syllabusPage.text;
  }

  const policySource = [result.syllabusText, ...result.rawPages.map((p) => p.text)].join("\n");
  result.policies = extractPolicies(policySource);

  const structuredPeople = collectStructuredPeople(result, seededInstructorCandidates, seededTaCandidates, seededOfficeHourEntries);
  result.instructors = structuredPeople.instructors;
  result.tas = structuredPeople.tas;
  result.officeHours = structuredPeople.officeHours;

  const dedupedExams = new Map();
  for (const exam of result.exams) {
    const key = `${(exam.title || "").toLowerCase()}|${exam.date || ""}|${exam.source || ""}`;
    if (!dedupedExams.has(key)) dedupedExams.set(key, exam);
  }
  result.exams = Array.from(dedupedExams.values()).slice(0, 80);
  result.assignments = result.assignments.slice(0, 120);
  result.announcements = result.announcements.slice(0, 60);
  result.fileLinks = dedupeFileLinks(result.fileLinks).slice(0, 80);

  return result;
}

async function runCanvasSync(fallbackCourseFn) {
  const context = detectCanvasPageContext();
  if (!context.isCanvas) throw new Error("Canvas sync can only run on Canvas pages.");

  sendSyncProgress("syncing_courses", "Discovering Canvas courses");
  const courses = await discoverCanvasCourses(fallbackCourseFn);
  if (!courses || courses.length === 0) throw new Error("No Canvas courses found to sync.");

  const syncedCourses = [];
  const failedCourses = [];

  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];
    sendSyncProgress("syncing_course", `Syncing ${course.courseName}`, {
      current: i + 1,
      total: courses.length,
      courseId: course.courseId,
    });
    try {
      const synced = await syncSingleCanvasCourse(course);
      syncedCourses.push(synced);
    } catch (err) {
      failedCourses.push({
        courseId: course.courseId,
        courseName: course.courseName,
        error: err?.message || String(err),
      });
    }
  }

  if (syncedCourses.length === 0) {
    throw new Error("Sync failed for all courses.");
  }

  const payload = {
    version: CANVAS_SYNC_VERSION,
    syncedAt: new Date().toISOString(),
    sourceHost: window.location.host,
    pageContext: context,
    courseCount: syncedCourses.length,
    failedCourses,
    courses: syncedCourses,
  };

  await storageLocalSet({ [CANVAS_SYNC_STORAGE_KEY]: payload });
  sendSyncProgress("sync_complete", "Canvas sync complete", {
    courseCount: syncedCourses.length,
    failedCount: failedCourses.length,
  });
  return payload;
}

export function handleCanvasSyncMessage(msg, sendResponse, fallbackCourseFn = () => []) {
  if (msg.type === "GET_CANVAS_PAGE_CONTEXT") {
    try {
      sendResponse({ success: true, data: detectCanvasPageContext() });
    } catch (err) {
      sendResponse({ success: false, error: err?.message || String(err) });
    }
    return true;
  }

  if (msg.type === "GET_CANVAS_SYNC_STATE") {
    storageLocalGet([CANVAS_SYNC_STORAGE_KEY])
      .then((data) => sendResponse({ success: true, data: data[CANVAS_SYNC_STORAGE_KEY] || null }))
      .catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
  }

  if (msg.type === "SYNC_CANVAS_DATA") {
    runCanvasSync(fallbackCourseFn)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
  }

  return false;
}

export function isLikelyCanvasQuestion(question = "") {
  const q = String(question || "").toLowerCase();
  return /(canvas|course|class|syllabus|assignment|quiz|exam|due|announcement|module|late work|attendance|grading|midterm|final|professor|instructor|ta|office hour|contact)/.test(q);
}

export async function getCanvasSyncSnapshot() {
  const data = await storageLocalGet([CANVAS_SYNC_STORAGE_KEY]);
  return data[CANVAS_SYNC_STORAGE_KEY] || null;
}


