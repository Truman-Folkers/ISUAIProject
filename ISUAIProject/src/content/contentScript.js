console.log("✅ CyAI content script LOADING...");

// Test if this script is actually running
window.__cyaiLoaded = true;
console.log("✅ CyAI content script STARTED - window.__cyaiLoaded =", window.__cyaiLoaded);

// Wait for DOM to be ready before creating sidebar
function initSidebar() {
  console.log("✅ Initializing sidebar...");
  
  const sidebar = document.createElement("div");
  sidebar.id = "ai-sidebar-root";
  sidebar.style.position = "fixed";
  sidebar.style.top = "0";
  sidebar.style.right = "0";
  sidebar.style.width = "450px";
  sidebar.style.height = "100vh";
  sidebar.style.zIndex = "999999";

  document.body.appendChild(sidebar);

  // Load the React sidebar app
  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("src/sidebar/index.html");
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";

  sidebar.appendChild(iframe);
  console.log("✅ Sidebar container added");
}

// Make sure DOM is ready
if (document.body) {
  initSidebar();
} else {
  document.addEventListener("DOMContentLoaded", initSidebar);
}

function scrapeCanvasTodoSidebar() {
  const list = document.querySelector("#planner-todosidebar-item-list");
  if (!list) return [];

  const items = [...list.querySelectorAll("li")];

  return items
    .map((li) => {
      const root = li.querySelector(".ToDoSidebarItem") || li;

      const titleLink =
        root.querySelector(".ToDoSidebarItem__Title a") ||
        root.querySelector('[data-testid="todo-sidebar-item-title"] a') ||
        root.querySelector("a");

      const title =
        titleLink?.querySelector("span")?.innerText?.trim() ||
        titleLink?.innerText?.trim() ||
        null;

      const href = titleLink?.getAttribute("href") || null;
      const url = href ? new URL(href, window.location.origin).toString() : null;

      const course =
        root.querySelector(".ToDoSidebarItem__Info > span")?.innerText?.trim() ||
        null;

      const infoRow =
        root.querySelector('[data-testid="ToDoSidebarItem__InformationRow"]') ||
        root.querySelector(".ToDoSidebarItem__InformationRow");

      const due_text = infoRow?.innerText?.trim() || null;

      if (!title && !course && !due_text) return null;

      return { title, course, due_text, url };
    })
    .filter(Boolean);
}

function scrapeCanvasCourses() {
  const courses = [];
  
  // Look for all links that might be courses
  const allLinks = document.querySelectorAll("a[href*='/courses/']");
  console.log("Found links with /courses/:", allLinks.length);
  
  allLinks.forEach((link) => {
    const href = link.getAttribute("href");
    console.log("Processing link:", href);
    
    // Extract course ID from various URL patterns
    let courseId = null;
    let match = href.match(/\/courses\/(\d+)/);
    if (match) {
      courseId = match[1];
    }
    
    const courseName = link.innerText?.trim();
    
    console.log("Course ID:", courseId, "Name:", courseName);
    
    if (courseId && courseName && !courses.find(c => c.id === courseId)) {
      try {
        const fullUrl = new URL(href, window.location.origin).toString();
        courses.push({
          id: courseId,
          name: courseName,
          url: fullUrl
        });
        console.log("Added course:", courseId, courseName);
      } catch (err) {
        console.error("Error constructing URL:", err);
      }
    }
  });
  
  console.log("Total courses found:", courses.length, courses);
  return courses;
}

console.log("✅ CyAI content script LOADED - message listener active");

// Catch ALL messages for debugging
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("📨 [CONTENT SCRIPT] Message received:", msg.type, "from:", sender);
  
  if (msg.type === "SCRAPE_PAGE") {
    console.log("🔄 Processing SCRAPE_PAGE");
    try {
      const data = scrapeCanvasTodoSidebar();
      console.log("✅ SCRAPE_PAGE successful, sending data:", data.length, "items");
      sendResponse({ success: true, data });
    } catch (err) {
      console.error("❌ Scrape failed:", err);
      sendResponse({ success: false, error: err?.message || String(err) });
    }
    return true;
  }
  
  if (msg.type === "SCRAPE_COURSES") {
    console.log("🔄 Processing SCRAPE_COURSES");
    try {
      const courses = scrapeCanvasCourses();
      console.log("✅ SCRAPE_COURSES successful, sending data:", courses.length, "courses");
      sendResponse({ success: true, data: courses });
    } catch (err) {
      console.error("❌ Course scrape failed:", err);
      sendResponse({ success: false, error: err?.message || String(err) });
    }
    return true;
  }
  
  console.log("⚠️ [CONTENT SCRIPT] Unknown message type:", msg.type);
  return false;
});
