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
    () => {
      void chrome.runtime.lastError;
    }
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

async function fetchPlannerItems() {
  const start = new Date().toISOString();
  const resp = await fetchCanvasJson(
    `${window.location.origin}/api/v1/planner/items?start_date=${start}&per_page=100&order=asc`
  );
  return Array.isArray(resp) ? resp : [];
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const text = doc.body?.innerText || "";
  return text.replace(/\n{3,}/g, "\n\n").trim();
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
    } catch {}
  }
  return links;
}

function splitMeaningfulLines(text) {
  return (text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function extractPolicies(text) {
  const lines = splitMeaningfulLines(text);
  const policies = { lateWork: [], attendance: [], grading: [], other: [] };
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/(late|extension|make[- ]?up|penalt)/.test(lower)) policies.lateWork.push(line);
    else if (/(attendance|absen|participation)/.test(lower)) policies.attendance.push(line);
    else if (/(grading|grade|percent|weight|points)/.test(lower)) policies.grading.push(line);
    else if (/(exam|quiz|midterm|final|deadline|due)/.test(lower)) policies.other.push(line);
  }
  return {
    lateWork: policies.lateWork.slice(0, 20),
    attendance: policies.attendance.slice(0, 20),
    grading: policies.grading.slice(0, 20),
    other: policies.other.slice(0, 20),
  };
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

function normalizeAssignment(item, baseUrl) {
  let url;
  try {
    if (item?.html_url) url = new URL(item.html_url, baseUrl).toString();
  } catch {}
  return {
    title: item?.name || "Untitled assignment",
    dueAt: item?.due_at || undefined,
    url,
    rawText: truncateText((item?.description || "").replace(/<[^>]*>/g, " "), 900),
  };
}

function normalizeAnnouncement(item, baseUrl) {
  let url;
  try {
    if (item?.html_url) url = new URL(item.html_url, baseUrl).toString();
  } catch {}
  return {
    title: item?.title || "Announcement",
    postedAt: item?.posted_at || item?.created_at || undefined,
    url,
    rawText: truncateText((item?.message || "").replace(/<[^>]*>/g, " "), 900),
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
  } catch {}

  return fallbackCourseFn().map((c) => ({
    courseId: String(c.id),
    courseName: c.name,
    courseCode: undefined,
    courseUrl: c.url,
  }));
}

async function syncSingleCanvasCourse(course) {
  const now = new Date().toISOString();
  const base = course.courseUrl;
  const result = {
    courseId: String(course.courseId),
    courseName: course.courseName,
    courseCode: course.courseCode,
    courseUrl: base,
    scrapedAt: now,
    syllabusText: "",
    assignments: [],
    exams: [],
    announcements: [],
    policies: { lateWork: [], attendance: [], grading: [], other: [] },
    fileLinks: [],
    rawPages: [],
  };

  const id = encodeURIComponent(course.courseId);

  sendSyncProgress("indexing_assignments", `Indexing assignments for ${course.courseName}`);
  try {
    const assignments = await fetchCanvasJson(`${window.location.origin}/api/v1/courses/${id}/assignments?per_page=100`);
    result.assignments = (Array.isArray(assignments) ? assignments : []).map((a) => normalizeAssignment(a, base));
    result.exams.push(
      ...result.assignments
        .filter((a) => /(exam|quiz|midterm|final)/i.test(a.title))
        .map((a) => ({
          title: a.title,
          date: a.dueAt || extractDateSnippet(a.rawText || ""),
          source: "assignments",
          url: a.url,
          rawText: (a.rawText || "").slice(0, 300),
        }))
    );
  } catch {}

  sendSyncProgress("reading_announcements", `Reading announcements for ${course.courseName}`);
  try {
    const anns = await fetchCanvasJson(
      `${window.location.origin}/api/v1/courses/${id}/discussion_topics?only_announcements=true&per_page=30`
    );
    result.announcements = (Array.isArray(anns) ? anns : []).map((a) => normalizeAnnouncement(a, base));
    for (const a of result.announcements) {
      result.exams.push(...extractExamLikeItems(`${a.title}\n${a.rawText || ""}`, "announcements", a.url || base));
    }
  } catch {}

  const htmlSources = [
    { type: "home", url: `${base}` },
    { type: "syllabus", url: `${base}/assignments/syllabus` },
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
    } catch {}
  }

  if (!result.syllabusText) {
    const syllabusPage = result.rawPages.find((p) => p.type === "syllabus");
    if (syllabusPage) result.syllabusText = syllabusPage.text;
  }

  const policySource = [result.syllabusText, ...result.rawPages.map((p) => p.text)].join("\n");
  result.policies = extractPolicies(policySource);

  const dedup = new Map();
  for (const e of result.exams) {
    const key = `${(e.title || "").toLowerCase()}|${e.date || ""}|${e.source || ""}`;
    if (!dedup.has(key)) dedup.set(key, e);
  }
  result.exams = Array.from(dedup.values()).slice(0, 80);
  result.fileLinks = result.fileLinks
    .filter((l, idx, arr) => l?.url && arr.findIndex((x) => x.url === l.url) === idx)
    .slice(0, 80);

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
  let plannerItems = [];

  sendSyncProgress("reading_planner", "Reading upcoming planner items");
  try {
    const courseMap = new Map(courses.map((course) => [String(course.courseId), course]));
    plannerItems = (await fetchPlannerItems())
      .filter((item) => item?.plannable_type !== "announcement")
      .map((item) => {
        const plannable = item?.plannable || {};
        const courseId = String(item?.course_id || plannable?.course_id || "");
        const course = courseMap.get(courseId);
        const dueAt = plannable?.due_at || plannable?.todo_date || item?.plannable_date || undefined;
        let url;
        if (courseId && item?.plannable_id) {
          const typeMap = {
            assignment: "assignments",
            quiz: "quizzes",
            discussion_topic: "discussion_topics",
          };
          url = `${window.location.origin}/courses/${courseId}/${typeMap[item.plannable_type] || "assignments"}/${item.plannable_id}`;
        }

        return {
          id: item?.plannable_id != null ? String(item.plannable_id) : undefined,
          courseId,
          courseName: course?.courseName || item?.context_name || `Course ${courseId}`,
          courseCode: course?.courseCode,
          title: plannable?.title || item?.plannable_id || "Untitled",
          dueAt,
          url,
          plannableType: item?.plannable_type || undefined,
        };
      })
      .filter((item) => item.courseId && item.title)
      .sort((left, right) => {
        const leftTime = left?.dueAt ? new Date(left.dueAt).getTime() : Number.POSITIVE_INFINITY;
        const rightTime = right?.dueAt ? new Date(right.dueAt).getTime() : Number.POSITIVE_INFINITY;
        return leftTime - rightTime;
      })
      .slice(0, 100);
  } catch {}

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
    plannerItems,
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
  return /(canvas|course|class|syllabus|assignment|quiz|exam|due|announcement|module|late work|attendance|grading|midterm|final)/.test(q);
}

export async function getCanvasSyncSnapshot() {
  const data = await storageLocalGet([CANVAS_SYNC_STORAGE_KEY]);
  return data[CANVAS_SYNC_STORAGE_KEY] || null;
}
