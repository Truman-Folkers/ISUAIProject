// CyAI Content Script

if (!document.body) {
  document.addEventListener("DOMContentLoaded", initSidebar);
} else {
  initSidebar();
}

function initSidebar() {
  const sidebar = document.createElement("div");
  sidebar.id = "ai-sidebar-root";
  sidebar.style.position = "fixed";
  sidebar.style.top = "0";
  sidebar.style.right = "0";
  sidebar.style.width = "50px";
  sidebar.style.height = "100vh";
  sidebar.style.borderTopLeftRadius = "25px";
  sidebar.style.borderBottomLeftRadius = "25px";
  sidebar.style.zIndex = "999999";
  sidebar.style.transition = "width 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
  sidebar.style.willChange = "width";
  sidebar.style.pointerEvents = "all";
  sidebar.style.boxShadow = "0px 0 10px rgba(0, 0, 0, 0.15)";
  sidebar.style.backgroundColor = "rgb(255, 255, 250)";

  const iframeUrl = chrome.runtime.getURL("src/sidebar/index.html");
  const iframe = document.createElement("iframe");
  iframe.src = iframeUrl;
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.style.overflow = "hidden";
  iframe.style.pointerEvents = "none";

  sidebar.addEventListener("mouseenter", () => {
    sidebar.style.width = "clamp(260px, 28vw, 380px)";
    iframe.style.pointerEvents = "all";
    iframe.contentWindow?.postMessage({ type: "SIDEBAR_EXPAND" }, "*");
  });
  sidebar.addEventListener("mouseleave", () => {
    sidebar.style.width = "50px";
    iframe.style.pointerEvents = "none";
    iframe.contentWindow?.postMessage({ type: "SIDEBAR_COLLAPSE" }, "*");
  });

  sidebar.appendChild(iframe);
  document.body.appendChild(sidebar);

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
        .filter(item => {
          if(window.location.pathname.includes("/courses/")){
            return item.course_id === Number(window.location.pathname.match(/\/courses\/(\d+)/)[1]) && item.plannable_type !== "announcement";
          }else{
            return item.plannable_type !== "announcement";
          }
        })
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
