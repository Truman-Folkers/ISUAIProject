const EMAIL_GLOBAL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const EMAIL_TEST_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const DAY_TIME_RE =
  /\b(?:mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)(?:\s*\/\s*(?:mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?))*[\s,:-]*(?:\d{1,2}(?::\d{2})?\s*(?:a\.?m?\.?|p\.?m?\.?)?\s*(?:-|to|until|through|–|—)\s*\d{1,2}(?::\d{2})?\s*(?:a\.?m?\.?|p\.?m?\.?)|by appointment)\b/i;
const OFFICE_HOURS_RE = /\b(?:office hours?|oh|available|availability|drop-?in hours?)\b/i;
const INSTRUCTOR_RE = /\b(?:instructor|professor|prof\.?|lecturer|course instructor|taught by|contact(?: person)?|faculty)\b/i;
const TA_RE = /\b(?:ta|t\.a\.|teaching assistant|lab instructor|discussion leader|discussion section instructor)\b/i;

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToPlainText(html) {
  return normalizeWhitespace(String(html || "").replace(/<[^>]*>/g, " "));
}

function truncateText(text, max = 6000) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}\n\n[truncated]` : text;
}

function toAbsoluteUrl(url, baseUrl) {
  try {
    return url ? new URL(url, baseUrl).toString() : undefined;
  } catch {
    return undefined;
  }
}

function splitMeaningfulLines(text) {
  return normalizeWhitespace(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitTextBlocks(text) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const lines = splitMeaningfulLines(normalized);
  const windows = [];
  for (let index = 0; index < lines.length; index += 1) {
    const windowLines = lines.slice(index, index + 5);
    if (windowLines.length === 0) continue;
    const joined = windowLines.join("\n");
    if (INSTRUCTOR_RE.test(joined) || TA_RE.test(joined) || OFFICE_HOURS_RE.test(joined) || EMAIL_TEST_RE.test(joined)) {
      windows.push(joined);
    }
  }
  return Array.from(new Set([...paragraphs, ...windows]));
}

function normalizeName(name) {
  return String(name || "")
    .replace(/^(?:name|instructor|professor|prof\.?|lecturer|course instructor|contact|ta|t\.a\.|teaching assistant|office hours?)\s*[:-]\s*/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyPersonName(value) {
  const text = normalizeName(value);
  if (!text) return false;
  if (EMAIL_TEST_RE.test(text)) return false;
  if (text.length > 80 || text.length < 4) return false;
  const cleaned = text.replace(/^(dr|prof|professor|mr|mrs|ms)\.?\s+/i, "");
  if (!/^[A-Za-z][A-Za-z'`.-]+(?:\s+[A-Za-z][A-Za-z'`.-]+){1,4}$/.test(cleaned)) return false;
  return !/(office|hours|course|section|room|zoom|phone|email)/i.test(cleaned);
}

function titleCaseRole(role, fallback) {
  const text = String(role || fallback || "").trim();
  if (!text) return undefined;
  if (/^ta$|^t\.a\.$/i.test(text)) return "TA";
  if (/prof/i.test(text)) return "Professor";
  if (/lecturer/i.test(text)) return "Lecturer";
  if (/instructor|faculty|contact/i.test(text)) return "Instructor";
  if (/teaching assistant/i.test(text)) return "Teaching Assistant";
  if (/lab instructor/i.test(text)) return "Lab Instructor";
  if (/discussion/i.test(text)) return "Discussion Leader";
  return text
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferRole(block, fallbackType) {
  const text = String(block || "");
  if (TA_RE.test(text)) {
    return titleCaseRole(
      text.match(/\b(?:ta|t\.a\.|teaching assistant|lab instructor|discussion leader|discussion section instructor)\b/i)?.[0],
      "TA"
    );
  }
  if (INSTRUCTOR_RE.test(text)) {
    return titleCaseRole(
      text.match(/\b(?:instructor|professor|prof\.?|lecturer|course instructor|faculty)\b/i)?.[0],
      fallbackType === "ta" ? "TA" : "Instructor"
    );
  }
  return titleCaseRole(fallbackType === "ta" ? "TA" : "Instructor");
}

function extractLabeledValue(block, labels) {
  const labelPattern = Array.isArray(labels) ? labels.join("|") : labels;
  const match = String(block || "").match(new RegExp(`(?:^|\\n)\\s*(?:${labelPattern})\\s*[:\\-]\\s*([^\\n]+)`, "i"));
  return match ? normalizeWhitespace(match[1]) : undefined;
}

function parseOfficeHourLines(block) {
  const lines = splitMeaningfulLines(block);
  const officeHours = [];
  for (const line of lines) {
    if (OFFICE_HOURS_RE.test(line) || DAY_TIME_RE.test(line)) {
      const cleaned = normalizeWhitespace(line.replace(/^(?:office hours?|oh|available|availability)\s*[:-]?\s*/i, ""));
      if (cleaned) officeHours.push(cleaned);
    }
  }
  return Array.from(new Set(officeHours));
}

function parsePersonBlock(block, source, fallbackType) {
  const text = normalizeWhitespace(block);
  if (!text) return null;

  const emails = extractEmails(text);
  const officeHours = parseOfficeHourLines(text);
  const office =
    extractLabeledValue(text, ["office", "location", "room"]) ||
    splitMeaningfulLines(text).find((line) => /\b(?:office|room|building|hall|zoom)\b/i.test(line) && !OFFICE_HOURS_RE.test(line));

  const labeledName =
    extractLabeledValue(text, [
      "instructor",
      "professor",
      "prof\\.",
      "lecturer",
      "course instructor",
      "taught by",
      "contact",
      "ta",
      "t\\.a\\.",
      "teaching assistant",
      "name",
    ]) ||
    splitMeaningfulLines(text).find((line) => {
      const stripped = line.replace(/^(?:instructor|professor|prof\.?|lecturer|course instructor|taught by|contact|ta|t\.a\.|teaching assistant)\s*[:-]?\s*/i, "");
      return isLikelyPersonName(stripped);
    });

  const name = normalizeName(labeledName);
  const role = inferRole(text, fallbackType);

  if (!name && emails.length === 0 && officeHours.length === 0 && !office) return null;

  return {
    name: name || undefined,
    role,
    email: emails[0],
    office: office ? normalizeWhitespace(office) : undefined,
    officeHours,
    source,
    rawText: truncateText(text, 1200),
  };
}

function extractPeopleFromBlocks(text, source, matcher, fallbackType) {
  const records = [];
  for (const block of splitTextBlocks(text)) {
    if (!matcher.test(block) && !EMAIL_TEST_RE.test(block)) continue;
    const record = parsePersonBlock(block, source, fallbackType);
    if (!record) continue;
    if (fallbackType === "ta" && !TA_RE.test(block) && !/\bta\b/i.test(record.role || "")) continue;
    if (fallbackType === "instructor" && TA_RE.test(block) && !INSTRUCTOR_RE.test(block)) continue;
    records.push(record);
  }
  return records;
}

export function extractEmails(text) {
  return Array.from(new Set((String(text || "").match(EMAIL_GLOBAL_RE) || []).map((email) => email.toLowerCase())));
}

export function extractInstructorCandidates(text, source) {
  return extractPeopleFromBlocks(text, source, INSTRUCTOR_RE, "instructor");
}

export function extractTaCandidates(text, source) {
  return extractPeopleFromBlocks(text, source, TA_RE, "ta");
}

export function extractOfficeHourEntries(text, source) {
  const entries = [];
  for (const block of splitTextBlocks(text)) {
    if (!OFFICE_HOURS_RE.test(block) && !DAY_TIME_RE.test(block)) continue;
    const hours = parseOfficeHourLines(block);
    if (hours.length === 0) continue;
    const person = parsePersonBlock(block, source, /(?:\bta\b|teaching assistant|lab instructor|discussion leader)/i.test(block) ? "ta" : "instructor");
    const location =
      extractLabeledValue(block, ["office", "location", "room", "zoom"]) ||
      splitMeaningfulLines(block).find((line) => /\b(?:office|room|building|hall|zoom|online)\b/i.test(line));
    for (const hoursText of hours) {
      entries.push({
        personName: person?.name,
        role: person?.role,
        hoursText,
        location: location ? normalizeWhitespace(location) : undefined,
        source,
        rawText: truncateText(normalizeWhitespace(block), 1200),
      });
    }
  }
  return entries;
}

function mergeStringLists(left = [], right = []) {
  return Array.from(new Set([...left, ...right].filter(Boolean)));
}

export function dedupeOfficeHours(entries = []) {
  const merged = new Map();
  for (const entry of entries) {
    if (!entry?.hoursText) continue;
    const key = [
      normalizeName(entry.personName || "").toLowerCase(),
      String(entry.role || "").toLowerCase(),
      normalizeWhitespace(entry.hoursText).toLowerCase(),
      normalizeWhitespace(entry.location || "").toLowerCase(),
    ].join("|");
    if (!merged.has(key)) {
      merged.set(key, {
        personName: entry.personName ? normalizeName(entry.personName) : undefined,
        role: titleCaseRole(entry.role, undefined),
        hoursText: normalizeWhitespace(entry.hoursText),
        location: entry.location ? normalizeWhitespace(entry.location) : undefined,
        source: entry.source,
        rawText: entry.rawText,
      });
    }
  }
  return Array.from(merged.values());
}

export function normalizePersonRecords(records = [], officeHourEntries = []) {
  const merged = new Map();
  const normalizedOfficeHours = dedupeOfficeHours(officeHourEntries);
  for (const record of records) {
    if (!record) continue;
    const name = normalizeName(record.name);
    const email = record.email ? String(record.email).toLowerCase() : undefined;
    const role = titleCaseRole(record.role, undefined);
    if (!name && !email) continue;
    const key = [name.toLowerCase(), email || "", (role || "").toLowerCase()].join("|");
    const existing = merged.get(key);
    const ownHours = normalizedOfficeHours
      .filter((entry) => {
        if (entry.personName && name) {
          return normalizeName(entry.personName).toLowerCase() === name.toLowerCase();
        }
        return false;
      })
      .map((entry) => entry.hoursText);
    const nextRecord = {
      name: name || undefined,
      role,
      email,
      office: record.office ? normalizeWhitespace(record.office) : undefined,
      officeHours: mergeStringLists(record.officeHours, ownHours),
      source: record.source,
      rawText: record.rawText,
    };
    if (!existing) {
      merged.set(key, nextRecord);
      continue;
    }
    merged.set(key, {
      name: existing.name || nextRecord.name,
      role: existing.role || nextRecord.role,
      email: existing.email || nextRecord.email,
      office: existing.office || nextRecord.office,
      officeHours: mergeStringLists(existing.officeHours, nextRecord.officeHours),
      source: existing.source || nextRecord.source,
      rawText: existing.rawText?.length >= (nextRecord.rawText || "").length ? existing.rawText : nextRecord.rawText,
    });
  }
  return Array.from(merged.values());
}

function summarizeText(text, maxLength = 220) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  const sentenceBreak = normalized.slice(0, maxLength).lastIndexOf(". ");
  if (sentenceBreak > 80) return `${normalized.slice(0, sentenceBreak + 1).trim()}`;
  return `${normalized.slice(0, maxLength).trim()}...`;
}

function importantTextLines(text, patterns, max = 6) {
  return splitMeaningfulLines(text)
    .filter((line) => patterns.some((pattern) => pattern.test(line)))
    .slice(0, max);
}

export function normalizeAssignment(item, baseUrl, assignmentGroupMap = {}, now = new Date()) {
  const descriptionText = htmlToPlainText(item?.description || "");
  const dueAt = item?.due_at || undefined;
  const unlockAt = item?.unlock_at || undefined;
  const lockAt = item?.lock_at || undefined;
  const submissionTypes = Array.isArray(item?.submission_types) ? item.submission_types.filter(Boolean) : [];
  const keyLines = importantTextLines(descriptionText, [
    /\bdue\b/i,
    /\bavailable\b/i,
    /\bpoints?\b/i,
    /\bsubmit|submission\b/i,
    /\blate\b/i,
    /\bquiz|exam|midterm|final\b/i,
  ]);
  const dueDate = dueAt ? new Date(dueAt) : null;
  const isDueDateValid = dueDate && !Number.isNaN(dueDate.getTime());
  const nowDate = now instanceof Date ? now : new Date(now);
  return {
    id: item?.id != null ? String(item.id) : undefined,
    title: item?.name || "Untitled assignment",
    dueAt,
    unlockAt,
    lockAt,
    url: toAbsoluteUrl(item?.html_url, baseUrl),
    pointsPossible: typeof item?.points_possible === "number" ? item.points_possible : undefined,
    submissionTypes,
    assignmentGroupId: item?.assignment_group_id != null ? String(item.assignment_group_id) : undefined,
    assignmentGroup: assignmentGroupMap[item?.assignment_group_id] || item?.assignment_group_name || undefined,
    summary: summarizeText(descriptionText),
    keyTextLines: keyLines,
    rawText: truncateText(descriptionText, 1400),
    isExamLike: /\b(?:exam|quiz|midterm|final|test)\b/i.test(`${item?.name || ""}\n${descriptionText}`),
    hasDueDate: Boolean(dueAt),
    isUpcoming: Boolean(isDueDateValid && dueDate >= nowDate),
    isPastDue: Boolean(isDueDateValid && dueDate < nowDate),
    missingDueDate: !dueAt,
  };
}

export function extractAnnouncementFlags(text = "") {
  const normalized = normalizeWhitespace(text);
  return {
    examRelated: /\b(?:exam|quiz|midterm|final|test)\b/i.test(normalized),
    dueDateRelated: /\b(?:due|deadline|tonight|tomorrow|submit|submission)\b/i.test(normalized),
    officeHoursRelated: /\b(?:office hours?|oh|zoom office hours?|available for questions)\b/i.test(normalized),
    policyRelated: /\b(?:policy|attendance|late work|grading|extension|required)\b/i.test(normalized),
    cancellationRelated: /\b(?:canceled|cancelled|postponed|moved|changed|rescheduled|room change|class canceled)\b/i.test(normalized),
  };
}

export function scoreAnnouncementImportance(text = "", title = "") {
  const hay = `${title}\n${text}`;
  let score = 0;
  if (/\b(?:urgent|required|important)\b/i.test(hay)) score += 2;
  if (/\b(?:exam|midterm|final|quiz|project|demo|presentation)\b/i.test(hay)) score += 2;
  if (/\b(?:due tonight|due tomorrow|deadline|tomorrow|tonight)\b/i.test(hay)) score += 2;
  if (/\b(?:moved|changed|postponed|canceled|cancelled|room change|class canceled)\b/i.test(hay)) score += 2;
  if (/\b(?:office hours?|oh)\b/i.test(hay)) score += 1;
  return score;
}

export function normalizeAnnouncement(item, baseUrl) {
  const bodyText = htmlToPlainText(item?.message || "");
  const flags = extractAnnouncementFlags(`${item?.title || ""}\n${bodyText}`);
  const importanceScore = scoreAnnouncementImportance(bodyText, item?.title || "");
  return {
    id: item?.id != null ? String(item.id) : undefined,
    title: item?.title || "Announcement",
    postedAt: item?.posted_at || item?.created_at || undefined,
    url: toAbsoluteUrl(item?.html_url, baseUrl),
    summary: summarizeText(bodyText),
    flags,
    importanceScore,
    isImportant: importanceScore >= 3 || Object.values(flags).filter(Boolean).length >= 2,
    rawText: truncateText(bodyText, 1400),
  };
}

export function dedupeAssignments(assignments = []) {
  const merged = new Map();
  for (const assignment of assignments) {
    if (!assignment) continue;
    const key = [assignment.id || "", assignment.url || "", normalizeWhitespace(assignment.title).toLowerCase()].join("|");
    if (!merged.has(key)) merged.set(key, assignment);
  }
  return Array.from(merged.values()).sort((left, right) => {
    const leftTime = left?.dueAt ? new Date(left.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const rightTime = right?.dueAt ? new Date(right.dueAt).getTime() : Number.POSITIVE_INFINITY;
    return leftTime - rightTime;
  });
}

export function dedupeAnnouncements(announcements = []) {
  const merged = new Map();
  for (const announcement of announcements) {
    if (!announcement) continue;
    const key = [announcement.id || "", announcement.url || "", normalizeWhitespace(announcement.title).toLowerCase()].join("|");
    const existing = merged.get(key);
    if (!existing || (announcement.importanceScore || 0) > (existing.importanceScore || 0)) {
      merged.set(key, announcement);
    }
  }
  return Array.from(merged.values()).sort((left, right) => {
    const rightTime = right?.postedAt ? new Date(right.postedAt).getTime() : 0;
    const leftTime = left?.postedAt ? new Date(left.postedAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

export function dedupeFileLinks(fileLinks = []) {
  const seen = new Set();
  return fileLinks.filter((link) => {
    if (!link?.url || seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

export function extractPolicies(text) {
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

export function normalizeSourceText(text) {
  return normalizeWhitespace(text);
}

