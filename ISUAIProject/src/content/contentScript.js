import { handleCanvasSyncMessage } from "./canvasSync.js";
// CyAI Content Script

if (!document.body) {
  document.addEventListener("DOMContentLoaded", initSidebar);
} else {
  initSidebar();
}

function initSidebar() {
  if (document.getElementById("ai-widget-root")) return;

  if (!document.getElementById("cyai-widget-styles")) {
    const style = document.createElement("style");
    style.id = "cyai-widget-styles";
    style.textContent = `
      #ai-widget-root {
        position: fixed;
        right: 0;
        bottom: 0;
        z-index: 999999;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        min-width: 56px;
      }
      #ai-greeting-stack {
        position: absolute;
        right: 0;
        bottom: 64px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0;
        pointer-events: auto;
        width: 220px;
        min-height: 160px;
      }
      #ai-sidebar-root {
        width: clamp(340px, 24vw, 380px);
        height: clamp(500px, 64vh, 600px);
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid rgba(30, 41, 59, 0.14);
        background: #fffdfa;
        box-shadow: 0 20px 48px rgba(15, 23, 42, 0.22);
        transform-origin: bottom right;
        transition: opacity 180ms ease, transform 220ms ease, visibility 220ms ease;
        opacity: 0;
        visibility: hidden;
        transform: translateY(10px) scale(0.98);
        pointer-events: none;
        margin-bottom: 0;
      }
      #ai-widget-root.open #ai-sidebar-root {
        opacity: 1;
        visibility: visible;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }
      #ai-launcher-button {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: 1px solid rgba(30, 41, 59, 0.18);
        background: linear-gradient(140deg, #b91c1c 0%, #991b1b 70%, #7f1d1d 100%);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 10px 26px rgba(127, 29, 29, 0.38);
        pointer-events: auto;
        transition: transform 170ms ease, box-shadow 170ms ease, filter 170ms ease;
        padding: 0;
      }
      #ai-launcher-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 14px 32px rgba(127, 29, 29, 0.45);
        filter: brightness(1.03);
      }
      #ai-launcher-button:active {
        transform: translateY(0);
      }
      #ai-launcher-button:focus-visible {
        outline: 3px solid rgba(255, 255, 255, 0.85);
        outline-offset: 2px;
      }
      #ai-launcher-icon {
        width: 92px;
        height: 92px;
        object-fit: contain;
      }
      #ai-launcher-close-overlay {
        position: absolute;
        top: -2px;
        right: -2px;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #dc2626;
        color: #fff;
        font-size: 14px;
        font-weight: 700;
        line-height: 1;
        display: none;
        align-items: center;
        justify-content: center;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
        pointer-events: none;
      }
      #ai-widget-root.open #ai-launcher-button {
        position: relative;
      }
      #ai-widget-root.open #ai-launcher-close-overlay {
        display: inline-flex;
      }
      #ai-sidebar-iframe {
        width: 100%;
        height: 100%;
        border: none;
      }
      #ai-greeting-bubble {
        background-image: url('${chrome.runtime.getURL("/assets/speech-bubbles.png")}');
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        padding: 16px 20px;
        border-radius: 12px;
        max-width: 200px;
        margin-bottom: 12px;
        font-size: 14px;
        color: black;
        font-weight: 500;
        line-height: 1.4;
        text-align: center;
        position: relative;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        pointer-events: auto;
        animation: slideUp 0.3s ease-out;
      }
      .ai-greeting-bubble {
        background-image: url('${chrome.runtime.getURL("/assets/speech-bubbles.png")}');
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        padding: 16px 20px;
        border-radius: 12px;
        max-width: 200px;
        margin: 0;
        font-size: 14px;
        color: black;
        font-weight: 500;
        line-height: 1.4;
        text-align: center;
        position: relative;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        pointer-events: auto;
        transition: transform 0.3s ease-out;
      }
      #greeting-bubble-1 {
        position: absolute;
        right: 0;
        bottom: 0;
        animation: slideIn 0.3s ease-out 1.4s both, moveUp 0.3s ease-out 2.8s forwards;
      }
      #greeting-bubble-2 {
        position: absolute;
        right: 0;
        bottom: 0;
        animation: slideIn 0.3s ease-out 3.2s both;
      }
      #greeting-bubble-typing {
        position: absolute;
        right: 0;
        bottom: 0;
        font-size: 22px;
        line-height: 1;
        letter-spacing: 2px;
        animation: slideIn 0.25s ease-out 0.3s both, fadeOut 0.25s ease-out 1.05s forwards;
      }
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(5px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes moveUp {
        from {
          transform: translateY(0);
        }
        to {
          transform: translateY(-75px);
        }
      }
      @keyframes fadeOut {
        from {
          opacity: 1;
        }
        to {
          opacity: 0;
        }
      }
      #ai-greeting-bubble::after {
        content: '';
        position: absolute;
        bottom: -8px;
        right: 20px;
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-top: 8px solid rgba(0, 0, 0, 0.1);
        border-right: 0 solid transparent;
      }
      .ai-greeting-bubble::after {
        content: '';
        position: absolute;
        bottom: -8px;
        right: 20px;
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-top: 8px solid rgba(0, 0, 0, 0.1);
        border-right: 0 solid transparent;
      }
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      #ai-widget-root.hide-greeting .ai-greeting-bubble {
        display: none;
      }
      #ai-widget-root.hide-greeting #ai-greeting-stack {
        display: none;
      }
      @media (max-width: 768px) {
        #ai-widget-root {
          right: 12px;
          bottom: 12px;
        }
        #ai-sidebar-root {
          width: 90vw;
          height: 70vh;
          max-width: 380px;
          max-height: 560px;
        }
        #ai-greeting-bubble {
          max-width: 160px;
          font-size: 13px;
          padding: 12px 16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const widgetRoot = document.createElement("div");
  widgetRoot.id = "ai-widget-root";

  const sidebar = document.createElement("div");
  sidebar.id = "ai-sidebar-root";

  const iframeUrl = chrome.runtime.getURL("src/sidebar/index.html");
  const iframe = document.createElement("iframe");
  iframe.id = "ai-sidebar-iframe";
  iframe.src = iframeUrl;
  iframe.style.overflow = "hidden";
  iframe.style.pointerEvents = "none";

  const launcher = document.createElement("button");
  launcher.id = "ai-launcher-button";
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Toggle CyAI assistant");
  launcher.setAttribute("title", "CyAI");

  const launcherIcon = document.createElement("img");
  launcherIcon.id = "ai-launcher-icon";
  launcherIcon.src = chrome.runtime.getURL("/assets/CyAILogo[Reg].png");
  launcherIcon.alt = "CyAI";
  launcher.appendChild(launcherIcon);

  const launcherCloseOverlay = document.createElement("span");
  launcherCloseOverlay.id = "ai-launcher-close-overlay";
  launcherCloseOverlay.setAttribute("aria-hidden", "true");
  launcherCloseOverlay.textContent = "X";
  launcher.appendChild(launcherCloseOverlay);

  sidebar.appendChild(iframe);
  
  // Extract user's first name from Canvas
  let userName = "there";
  try {
    // First priority: Check window.ENV.current_user which Canvas populates
    if (window.ENV && window.ENV.current_user && window.ENV.current_user.name) {
      const fullName = window.ENV.current_user.name.trim();
      if (fullName && fullName !== "You") {
        userName = fullName.split(" ")[0];
        console.log("Got name from ENV.current_user:", userName);
      }
    }
    
    // Second priority: Check for user info in common Canvas selectors
    if (userName === "there" || userName === "You") {
      const userNameSelectors = [
        '.user_name',
        '[data-api-returntype="User"]',
        '.current-user-name',
        'span[class*="user"]'
      ];
      
      for (let selector of userNameSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent?.trim();
          if (text && text.length > 1 && text.length < 50 && text !== "You" && !text.includes("@")) {
            userName = text.split(" ")[0];
            console.log("Got name from selector", selector, ":", userName);
            break;
          }
        }
      }
    }
    
    // Third priority: Check localStorage for Canvas user data
    if (userName === "there" || userName === "You") {
      const keys = Object.keys(localStorage);
      for (let key of keys) {
        if (key.includes("user") || key.includes("canvas")) {
          try {
            const value = localStorage.getItem(key);
            if (value && value.length < 1000) {
              const nameMatch = value.match(/"name"\s*:\s*"([^"]+)"/);
              if (nameMatch && nameMatch[1] && nameMatch[1] !== "You") {
                userName = nameMatch[1].split(" ")[0];
                console.log("Got name from localStorage key", key, ":", userName);
                break;
              }
            }
          } catch (e) {}
        }
      }
    }
    
    // Fourth priority: Look in page title or meta tags
    if (userName === "there" || userName === "You") {
      const pageTitle = document.title;
      const nameMatch = pageTitle.match(/([A-Z][a-z]+)\s+([A-Z][a-z]+)/);
      if (nameMatch) {
        userName = nameMatch[1];
        console.log("Got name from page title:", userName);
      }
    }
  } catch (e) {
    console.log("Error extracting user name:", e);
  }
  
  console.log("Final userName:", userName);
  
  const greetingBubble1 = document.createElement("div");
  greetingBubble1.className = "ai-greeting-bubble";
  greetingBubble1.id = "greeting-bubble-1";
  greetingBubble1.textContent = "Hello! I am CyAI your canvas virtual assistant.";

  const greetingTypingBubble = document.createElement("div");
  greetingTypingBubble.className = "ai-greeting-bubble";
  greetingTypingBubble.id = "greeting-bubble-typing";
  greetingTypingBubble.textContent = "...";
  
  const greetingBubble2 = document.createElement("div");
  greetingBubble2.className = "ai-greeting-bubble";
  greetingBubble2.id = "greeting-bubble-2";
  greetingBubble2.textContent = "You can access me anytime! How can I assist you today?";

  const greetingStack = document.createElement("div");
  greetingStack.id = "ai-greeting-stack";
  greetingStack.appendChild(greetingTypingBubble);
  greetingStack.appendChild(greetingBubble1);
  greetingStack.appendChild(greetingBubble2);
  
  widgetRoot.appendChild(greetingStack);
  widgetRoot.appendChild(sidebar);
  widgetRoot.appendChild(launcher);
  document.body.appendChild(widgetRoot);

  let isOpen = false;
  const syncWidgetState = () => {
    widgetRoot.classList.toggle("open", isOpen);
    iframe.style.pointerEvents = isOpen ? "all" : "none";
    launcher.setAttribute("title", isOpen ? "minimize to close" : "CyAI");
    launcher.setAttribute("aria-label", isOpen ? "Minimize to close" : "Open CyAI assistant");
    iframe.contentWindow?.postMessage({ type: isOpen ? "SIDEBAR_EXPAND" : "SIDEBAR_COLLAPSE" }, "*");
  };

  // Hide greeting bubbles after 13 seconds or on interaction
  setTimeout(() => {
    widgetRoot.classList.add("hide-greeting");
  }, 13000);

  greetingBubble1.addEventListener("click", () => {
    widgetRoot.classList.add("hide-greeting");
  });

  greetingTypingBubble.addEventListener("click", () => {
    widgetRoot.classList.add("hide-greeting");
  });

  greetingBubble2.addEventListener("click", () => {
    widgetRoot.classList.add("hide-greeting");
  });

  launcher.addEventListener("click", () => {
    isOpen = !isOpen;
    syncWidgetState();
    if (isOpen) {
      widgetRoot.classList.add("hide-greeting");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen) {
      isOpen = false;
      syncWidgetState();
    }
  });

  syncWidgetState();

  chrome.storage.sync.get("hiddenCourses", (data) => {
    if (data.hiddenCourses) applyDashboardCourseVisibility(data.hiddenCourses);
  });
}
/* =========================
   Canvas To-Do Scraper
========================= */

function buildCompactCourseLabel(courseObj, fallbackName = null) {
  const termName = courseObj?.term?.name || "";
  const year = termName.match(/(20\d{2})/)?.[1] || "";
  const seasonPrefix = /spring/i.test(termName)
    ? "S"
    : /summer/i.test(termName)
      ? "U"
      : /fall/i.test(termName)
        ? "F"
        : /winter/i.test(termName)
          ? "W"
          : "T";

  const rawCode =
    courseObj?.course_code ||
    courseObj?.sis_course_id ||
    fallbackName ||
    "";

  const deptNum = rawCode.match(/([A-Za-z]{2,6})\s*[-_ ]?([0-9]{3,4}[A-Za-z]?)/);
  if (deptNum) {
    const dept = deptNum[1].toUpperCase();
    const num = deptNum[2].toUpperCase();
    if (year) return `${seasonPrefix}${year}-${dept}-${num}`;
    return `${dept}-${num}`;
  }

  return fallbackName || rawCode || null;
}

async function fetchCourseMetaByIds(domain, courseIds) {
  const courseMetaById = new Map();
  await Promise.all(
    courseIds.map(async (courseId) => {
      try {
        const courseResp = await fetch(
          `${domain}/api/v1/courses/${courseId}?include[]=term`,
          { credentials: "include" }
        );
        if (courseResp.ok) {
          courseMetaById.set(courseId, await courseResp.json());
        }
      } catch (_) {}
    })
  );
  return courseMetaById;
}

function formatRemaining(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

async function detectGhostCourses() {
  const domain = window.location.origin;
  const targetPrefix = "S2026-";
  const dashboardCourses = scrapeVisibleDashboardCourses();

  if (dashboardCourses.length === 0) return [];

  const ghosts = [];
  for (const course of dashboardCourses) {
    const courseId = course.id;
    if (!courseId) continue;

    try {
      const resp = await fetch(`${domain}/api/v1/courses/${courseId}?include[]=term`, {
        credentials: "include",
      });
      if (!resp.ok) continue;

      const meta = await resp.json();
      const reasons = [];

      const compactLabel = buildCompactCourseLabel(meta, course.name || null);
      const normalized = String(compactLabel || "").toUpperCase();
      if (!normalized.startsWith(targetPrefix)) {
        reasons.push(`outside ${targetPrefix} (${compactLabel || "unknown term"})`);
      }

      if (reasons.length > 0) {
        ghosts.push({
          id: String(courseId),
          name: course.name || meta?.name || `Course ${courseId}`,
          label: compactLabel,
          reason: reasons.join(", "),
        });
      }
    } catch (_) {}
  }

  return ghosts;
}

async function scrapeCanvasTodoSidebar() {
  const domain = window.location.origin;

  try {
    const today = new Date().toISOString();
    const resp = await fetch(
      `${domain}/api/v1/planner/items?start_date=${today}&per_page=20&order=asc`,
      { credentials: "include" }
    );
    if (resp.ok) {
      const items = await resp.json();
      const filteredItems = items
        .filter(item => {
          if(window.location.pathname.includes("/courses/")){
            return item.course_id === Number(window.location.pathname.match(/\/courses\/(\d+)/)[1]) && item.plannable_type !== "announcement";
          }else{
            return item.plannable_type !== "announcement";
          }
        })
        .slice(0, 5);

      const courseIds = [...new Set(filteredItems.map((item) => item.course_id || item.plannable?.course_id).filter(Boolean))];
      const courseMetaById = await fetchCourseMetaByIds(domain, courseIds);

      return filteredItems.map((item) => {
          const plannable = item.plannable || {};
          const courseId = item.course_id || item.plannable?.course_id;
          const title = plannable.title || item.plannable_id || "Untitled";
          const dueAt = plannable.due_at || plannable.todo_date || item.plannable_date;
          const due_text = dueAt
            ? new Date(dueAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : "No due date";
          let url = null;
          if (courseId && item.plannable_id) {
            const typeMap = {
              assignment: "assignments",
              quiz: "quizzes",
              discussion_topic: "discussion_topics",
            };
            url = `${domain}/courses/${courseId}/${typeMap[item.plannable_type] || "assignments"}/${item.plannable_id}`;
          }
          const courseMeta = courseMetaById.get(courseId);
          const compactCourse = buildCompactCourseLabel(courseMeta, item.context_name || null);
          return { title, course: compactCourse, due_text, url };
        });
    }
  } catch (_) {}

  const results = [];
  const seen = new Set();
  for (const link of document.querySelectorAll(
    "a[href*='/assignments/'], a[href*='/quizzes/'], a[href*='/discussion_topics/']"
  )) {
    const href = link.getAttribute("href") || "";
    if (!href || seen.has(href)) continue;
    seen.add(href);
    const title = link.innerText?.trim();
    if (!title) continue;
    try {
      results.push({ title, course: null, due_text: null, url: new URL(href, domain).toString() });
    } catch (_) {}
    if (results.length >= 5) break;
  }
  return results;
}

async function scrapeComingUp72Hours() {
  const domain = window.location.origin;
  const now = Date.now();
  const cutoff = now + 72 * 60 * 60 * 1000;

  try {
    const start = new Date(now).toISOString();
    const resp = await fetch(
      `${domain}/api/v1/planner/items?start_date=${start}&per_page=100&order=asc`,
      { credentials: "include" }
    );

    if (!resp.ok) return [];
    const items = await resp.json();

    const filtered = items.filter((item) => {
      if (item.plannable_type === "announcement") return false;

      if (window.location.pathname.includes("/courses/")) {
        const currentCourseId = Number(window.location.pathname.match(/\/courses\/(\d+)/)?.[1]);
        if ((item.course_id || item.plannable?.course_id) !== currentCourseId) return false;
      }

      const plannable = item.plannable || {};
      const dueAt = plannable.due_at || plannable.todo_date || item.plannable_date;
      if (!dueAt) return false;

      const dueMs = new Date(dueAt).getTime();
      return Number.isFinite(dueMs) && dueMs >= now && dueMs <= cutoff;
    });

    const courseIds = [...new Set(filtered.map((item) => item.course_id || item.plannable?.course_id).filter(Boolean))];
    const courseMetaById = await fetchCourseMetaByIds(domain, courseIds);

    return filtered
      .map((item) => {
        const plannable = item.plannable || {};
        const courseId = item.course_id || item.plannable?.course_id;
        const title = plannable.title || item.plannable_id || "Untitled";
        const dueAt = plannable.due_at || plannable.todo_date || item.plannable_date;
        const dueMs = new Date(dueAt).getTime();
        const remainingMs = Math.max(0, dueMs - now);
        const dueText = new Date(dueAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

        let url = null;
        if (courseId && item.plannable_id) {
          const typeMap = {
            assignment: "assignments",
            quiz: "quizzes",
            discussion_topic: "discussion_topics",
          };
          url = `${domain}/courses/${courseId}/${typeMap[item.plannable_type] || "assignments"}/${item.plannable_id}`;
        }

        return {
          title,
          due_text: dueText,
          due_iso: dueAt,
          remaining_ms: remainingMs,
          remaining_text: formatRemaining(remainingMs),
          course: buildCompactCourseLabel(courseMetaById.get(courseId), item.context_name || null),
          url,
        };
      })
      .sort((a, b) => a.remaining_ms - b.remaining_ms);
  } catch (_) {
    return [];
  }
}

/* =========================
   Dashboard Course Scraper
========================= */

function scrapeDashboardCourses() {
  const courses = [];
  const seenIds = new Set();
  document
    .querySelectorAll("[data-testid*='course'], .course-card, .ic-DashboardCard, [class*='course']")
    .forEach((card) => {
      const href = card.querySelector("a")?.getAttribute("href");
      const match = href?.match(/\/courses\/(\d+)/);
      const courseId = match?.[1];
      if (courseId && !seenIds.has(courseId)) {
        seenIds.add(courseId);
        courses.push({
          id: courseId,
          name: card.querySelector("a")?.innerText?.trim() || `Course ${courseId}`,
          url: new URL(href, window.location.origin).toString(),
        });
      }
    });
  return courses;
}

function scrapeVisibleDashboardCourses() {
  const courses = [];
  const seenIds = new Set();

  const cards = document.querySelectorAll(
    "[data-testid*='course'], .course-card, .ic-DashboardCard, [class*='course']"
  );

  cards.forEach((card) => {
    const style = window.getComputedStyle(card);
    if (style.display === "none" || style.visibility === "hidden") return;

    const rect = card.getBoundingClientRect();
    const inViewport = rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
    if (!inViewport) return;

    const href = card.querySelector("a")?.getAttribute("href");
    const match = href?.match(/\/courses\/(\d+)/);
    const courseId = match?.[1];
    if (!courseId || seenIds.has(courseId)) return;

    seenIds.add(courseId);
    courses.push({
      id: courseId,
      name: card.querySelector("a")?.innerText?.trim() || `Course ${courseId}`,
      url: new URL(href, window.location.origin).toString(),
    });
  });

  return courses;
}

/* =========================
   Syllabus Scraper
========================= */

function scrapeSyllabus() {
  const main =
    document.querySelector("main") ||
    document.querySelector("[role='main']") ||
    document.body;
  let content = "";

  for (const sel of [
    ".syllabus-content",
    "[data-testid='syllabus']",
    ".syllabus",
    ".ic-RichContent",
    "article",
    ".user_content",
  ]) {
    const text = main.querySelector(sel)?.innerText?.trim();
    if (text && text.length > 50) {
      content = text;
      break;
    }
  }

  if (!content) {
    for (const section of main.querySelectorAll("section, article, div[role='region']")) {
      const heading = section.querySelector("h1, h2, h3")?.innerText?.toLowerCase() || "";
      if (heading.includes("syllabus") || heading.includes("course information")) {
        const text = section.innerText?.trim();
        if (text && text.length > 50) {
          content = text;
          break;
        }
      }
    }
  }

  if (!content) {
    content = (main.innerText?.trim() || "")
      .split("\n")
      .filter((l) => l.trim())
      .slice(0, 150)
      .join("\n");
  }

  content = content.replace(/\n\n+/g, "\n\n").trim();
  if (content.length > 5000) content = content.substring(0, 5000) + "\n\n[Content truncated...]";
  return content || "No syllabus content found on this page.";
}

/* =========================
   Course Visibility
========================= */

function applyDashboardCourseVisibility(hiddenCourses) {
  if (!hiddenCourses || Object.keys(hiddenCourses).length === 0) return;

  function hideCoursesNow() {
    let count = 0;
    document
      .querySelectorAll(
        "[data-testid*='course'], .course-card, .ic-DashboardCard, [class*='course'], article"
      )
      .forEach((card) => {
        const courseId = card
          .querySelector("a")
          ?.getAttribute("href")
          ?.match(/\/courses\/(\d+)/)?.[1];
        if (!courseId) return;
        if (hiddenCourses[courseId] && card.style.display !== "none") {
          card.style.display = "none";
          count++;
        } else if (!hiddenCourses[courseId] && card.style.display === "none") {
          card.style.display = "";
        }
      });
    return count;
  }

  if (hideCoursesNow() === 0) setTimeout(hideCoursesNow, 1000);

  new MutationObserver(hideCoursesNow).observe(
    document.querySelector("main") ||
      document.querySelector(".dashboard-content") ||
      document.body,
    { childList: true, subtree: true }
  );
}

/* =========================
   Message Listener
========================= */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SCRAPE_PAGE") {
    scrapeCanvasTodoSidebar()
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
  }
  if (msg.type === "SCRAPE_COMING_UP") {
    scrapeComingUp72Hours()
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
  }
  if (msg.type === "GET_DASHBOARD_COURSES") {
    try {
      sendResponse({ success: true, data: scrapeDashboardCourses() });
    } catch (err) {
      sendResponse({ success: false, error: err?.message || String(err) });
    }
    return true;
  }
  if (msg.type === "APPLY_COURSE_VISIBILITY") {
    try {
      applyDashboardCourseVisibility(msg.hiddenCourses || {});
      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ success: false, error: err?.message || String(err) });
    }
    return true;
  }
  if (msg.type === "DETECT_GHOST_COURSES") {
    detectGhostCourses()
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
  }
  if (msg.type === "SCRAPE_SYLLABUS") {
    try {
      sendResponse({ success: true, data: scrapeSyllabus() });
    } catch (err) {
      sendResponse({ success: false, error: err?.message || String(err) });
    }
    return true;
  }
  if (handleCanvasSyncMessage(msg, sendResponse, scrapeDashboardCourses)) return true;
  return false;
});





