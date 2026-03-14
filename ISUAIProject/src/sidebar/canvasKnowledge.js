/* global chrome */
const CANVAS_SYNC_STORAGE_KEY = "canvasKnowledgeBase";
const canvasQuestionRe = /(canvas|course|class|syllabus|assignment|quiz|exam|due|announcement|module|late work|attendance|grading|midterm|final|professor|instructor|ta|office hour|contact)/i;

const storageLocalGet = (keys) =>
  new Promise((resolve) => chrome.storage.local.get(keys, (data) => resolve(data || {})));

export function isLikelyCanvasQuestion(question = "") {
  return canvasQuestionRe.test(String(question || ""));
}

export async function getCanvasSyncSnapshot() {
  const data = await storageLocalGet([CANVAS_SYNC_STORAGE_KEY]);
  return data[CANVAS_SYNC_STORAGE_KEY] || null;
}

export async function getCanvasSyncMetadata() {
  const kb = await getCanvasSyncSnapshot();
  if (!kb) return null;
  return {
    syncedAt: kb.syncedAt || null,
    courseCount: kb.courseCount || (kb.courses || []).length,
    failedCount: (kb.failedCourses || []).length,
  };
}
