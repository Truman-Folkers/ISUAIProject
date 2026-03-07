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
        right: 10px;
        bottom: 10px;
        z-index: 999999;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }
      #ai-sidebar-root {
        width: clamp(340px, 24vw, 380px);
        height: clamp(470px, 60vh, 560px);
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
        margin-bottom: 14px;
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
        width: 28px;
        height: 28px;
        object-fit: contain;
      }
      #ai-sidebar-iframe {
        width: 100%;
        height: 100%;
        border: none;
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
  launcherIcon.src = chrome.runtime.getURL("icons/CyAILogo[Reg].png");
  launcherIcon.alt = "CyAI";
  launcher.appendChild(launcherIcon);

  sidebar.appendChild(iframe);
  widgetRoot.appendChild(sidebar);
  widgetRoot.appendChild(launcher);
  document.body.appendChild(widgetRoot);

  let isOpen = false;
  const syncWidgetState = () => {
    widgetRoot.classList.toggle("open", isOpen);
    iframe.style.pointerEvents = isOpen ? "all" : "none";
    iframe.contentWindow?.postMessage({ type: isOpen ? "SIDEBAR_EXPAND" : "SIDEBAR_COLLAPSE" }, "*");
  };

  launcher.addEventListener("click", () => {
    isOpen = !isOpen;
    syncWidgetState();
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
      return items
        .filter((item) => item.plannable_type !== "announcement")
        .slice(0, 5)
        .map((item) => {
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
          return { title, course: item.context_name || null, due_text, url };
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
  if (msg.type === "SCRAPE_SYLLABUS") {
    try {
      sendResponse({ success: true, data: scrapeSyllabus() });
    } catch (err) {
      sendResponse({ success: false, error: err?.message || String(err) });
    }
    return true;
  }
  return false;
});


