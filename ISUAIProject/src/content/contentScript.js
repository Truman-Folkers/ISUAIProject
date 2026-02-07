console.log("loaddded");
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
sidebar.style.transition = "width 0.3s ease-in-out, box-shadow 0.3s ease-in-out";
sidebar.style.boxShadow = "0px 0 10px rgba(0, 0, 0, 0.15)";
sidebar.addEventListener('mouseover', function(event){
    sidebar.style.width = "34vh";
})
sidebar.addEventListener('mouseout', function(event){
    sidebar.style.width = "50px";
})

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
  
  // Apply saved hidden courses to dashboard on page load
  chrome.storage.sync.get("hiddenCourses", (data) => {
    if (data.hiddenCourses && Object.keys(data.hiddenCourses).length > 0) {
      console.log("🔄 Applying saved hidden courses on page load:", data.hiddenCourses);
      applyDashboardCourseVisibility(data.hiddenCourses);
    }
  });
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

// Function to scrape courses from the dashboard view
function scrapeDashboardCourses() {
  console.log("🔍 Scraping dashboard courses...");
  const courses = [];
  
  // Look for course cards on the dashboard
  // Canvas typically uses cards or course containers with data attributes
  const courseCards = document.querySelectorAll("[data-testid*='course'], .course-card, .ic-DashboardCard, [class*='course']");
  console.log("Found course elements:", courseCards.length);
  
  // Also look for course links in the dashboard navigation
  const courseLinks = document.querySelectorAll("a[href*='/courses/'], [class*='course'] a");
  
  const seenIds = new Set();
  
  courseCards.forEach((card) => {
    const link = card.querySelector("a");
    if (!link) return;
    
    const href = link.getAttribute("href");
    if (!href) return;
    
    let courseId = null;
    const match = href.match(/\/courses\/(\d+)/);
    if (match) {
      courseId = match[1];
    }
    
    if (courseId && !seenIds.has(courseId)) {
      const courseName = link.innerText?.trim() || card.innerText?.trim() || `Course ${courseId}`;
      seenIds.add(courseId);
      courses.push({
        id: courseId,
        name: courseName,
        url: new URL(href, window.location.origin).toString(),
        element: card
      });
      console.log("✅ Found dashboard course:", courseId, courseName);
    }
  });
  
  console.log("Total dashboard courses found:", courses.length);
  return courses.map(c => ({ id: c.id, name: c.name, url: c.url }));
}

// Function to scrape syllabus content from course page
function scrapeSyllabus(courseId) {
  console.log("📄 Scraping syllabus for course:", courseId);
  
  let syllabusContent = "";
  
  // Strategy 1: Look for syllabus in current page
  const main = document.querySelector("main") || document.querySelector("[role='main']") || document.body;
  
  // Try multiple selectors for syllabus content
  const syllabusSelectors = [
    ".syllabus-content",
    "[data-testid='syllabus']",
    ".syllabus",
    ".ic-RichContent",
    "article",
    ".user_content"
  ];
  
  for (let selector of syllabusSelectors) {
    const element = main.querySelector(selector);
    if (element) {
      const text = element.innerText?.trim();
      if (text && text.length > 50) {
        syllabusContent = text;
        console.log("✅ Found syllabus content with selector:", selector);
        break;
      }
    }
  }
  
  // Strategy 2: If on home page, look for syllabus in all visible sections
  if (!syllabusContent) {
    const sections = main.querySelectorAll("section, article, div[role='region']");
    for (let section of sections) {
      const heading = section.querySelector("h1, h2, h3");
      const heading_text = heading?.innerText?.toLowerCase() || "";
      
      if (heading_text.includes("syllabus") || heading_text.includes("course information")) {
        const text = section.innerText?.trim();
        if (text && text.length > 50) {
          syllabusContent = text;
          console.log("✅ Found syllabus in section with heading:", heading_text);
          break;
        }
      }
    }
  }
  
  // Strategy 3: Get all visible text and filter
  if (!syllabusContent) {
    const allText = main.innerText?.trim() || "";
    // Remove navigation and sidebar noise
    const lines = allText.split('\n').filter(line => line.trim().length > 0);
    syllabusContent = lines.slice(0, 150).join('\n');
    console.log("✅ Using page text content");
  }
  
  // Clean up the content
  if (syllabusContent) {
    // Remove extra whitespace
    syllabusContent = syllabusContent.replace(/\n\n+/g, '\n\n').trim();
    
    // Truncate to reasonable length (5000 chars = ~1000 words)
    if (syllabusContent.length > 5000) {
      syllabusContent = syllabusContent.substring(0, 5000) + "\n\n[Content truncated...]";
    }
  } else {
    syllabusContent = "No syllabus content found on this page.";
  }
  
  console.log("✅ Syllabus content extracted:", syllabusContent.length, "characters");
  return syllabusContent;
}

// Function to hide/show courses on dashboard (with MutationObserver)
function applyDashboardCourseVisibility(hiddenCourses) {
  console.log("🔄 Applying course visibility settings:", hiddenCourses);
  
  if (!hiddenCourses || Object.keys(hiddenCourses).length === 0) {
    console.log("No hidden courses to apply");
    return;
  }
  
  // Function to hide specific courses
  function hideCoursesNow() {
    const courseCards = document.querySelectorAll("[data-testid*='course'], .course-card, .ic-DashboardCard, [class*='course'], article");
    
    let hidCount = 0;
    courseCards.forEach((card) => {
      const link = card.querySelector("a");
      if (!link) return;
      
      const href = link.getAttribute("href");
      const match = href?.match(/\/courses\/(\d+)/);
      const courseId = match ? match[1] : null;
      
      if (courseId && hiddenCourses[courseId]) {
        if (card.style.display !== "none") {
          console.log("🙈 Hiding course:", courseId);
          card.style.display = "none";
          hidCount++;
        }
      } else if (courseId && card.style.display === "none") {
        console.log("👁️ Showing course:", courseId);
        card.style.display = "";
      }
    });
    
    return hidCount;
  }
  
  // Initial hiding attempt
  let hidCount = hideCoursesNow();
  
  // If we didn't find courses on first try, retry
  if (hidCount === 0) {
    console.log("⏱️ Courses not found yet, retrying...");
    setTimeout(() => {
      hidCount = hideCoursesNow();
      if (hidCount > 0) {
        console.log("✅ Successfully hid", hidCount, "courses on retry");
      }
    }, 1000);
  } else {
    console.log("✅ Successfully hid", hidCount, "courses");
  }
  
  // Watch for new course cards being added and hide them
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        // Check if any new course cards were added
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const isCard = node.matches && (
              node.matches("[data-testid*='course']") ||
              node.matches(".course-card") ||
              node.matches(".ic-DashboardCard") ||
              node.matches("[class*='course']") ||
              node.matches("article")
            );
            
            if (isCard || (node.querySelector && (
              node.querySelector("[data-testid*='course']") ||
              node.querySelector(".course-card") ||
              node.querySelector(".ic-DashboardCard")
            ))) {
              console.log("📝 New course card detected, applying visibility...");
              hideCoursesNow();
            }
          }
        });
      }
    });
  });
  
  // Watch the main dashboard content area
  const dashboardContent = document.querySelector("main") || document.querySelector(".dashboard-content") || document.body;
  observer.observe(dashboardContent, {
    childList: true,
    subtree: true,
    attributes: false
  });
}

console.log("✅ CyAI content script LOADED - message listener active");

// Function to fetch courses via Canvas API (no navigation)
async function fetchCoursesViaAPI() {
  console.log("🔄 Fetching courses via Canvas API...");
  
  try {
    // Get the current Canvas domain
    const domain = window.location.origin;
    const apiUrl = `${domain}/api/v1/courses?per_page=100`;
    
    console.log("📋 API URL:", apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include' // Include cookies for authentication
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const courses = await response.json();
    console.log("✅ Courses fetched via API:", courses.length);
    
    // Format courses for display
    const formattedCourses = courses.map(course => ({
      id: course.id,
      name: course.name,
      url: `${domain}/courses/${course.id}`
    }));
    
    return { success: true, data: formattedCourses };
  } catch (err) {
    console.error("❌ API fetch failed:", err);
    return { success: false, error: err.message };
  }
}

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
  
  if (msg.type === "GET_COURSES_API") {
    console.log("🔄 Processing GET_COURSES_API (via Canvas API, no navigation)");
    fetchCoursesViaAPI()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  
  if (msg.type === "GET_DASHBOARD_COURSES") {
    console.log("🔄 Processing GET_DASHBOARD_COURSES");
    try {
      const courses = scrapeDashboardCourses();
      console.log("✅ Dashboard courses found:", courses.length);
      sendResponse({ success: true, data: courses });
    } catch (err) {
      console.error("❌ Dashboard scrape failed:", err);
      sendResponse({ success: false, error: err?.message || String(err) });
    }
    return true;
  }
  
  if (msg.type === "APPLY_COURSE_VISIBILITY") {
    console.log("🔄 Processing APPLY_COURSE_VISIBILITY");
    try {
      applyDashboardCourseVisibility(msg.hiddenCourses || {});
      console.log("✅ Applied visibility settings");
      sendResponse({ success: true });
    } catch (err) {
      console.error("❌ Apply visibility failed:", err);
      sendResponse({ success: false, error: err?.message || String(err) });
    }
    return true;
  }
  
  if (msg.type === "SCRAPE_SYLLABUS") {
    console.log("🔄 Processing SCRAPE_SYLLABUS");
    try {
      const syllabusContent = scrapeSyllabus(msg.courseId);
      console.log("✅ Syllabus scraped");
      sendResponse({ success: true, data: syllabusContent });
    } catch (err) {
      console.error("❌ Syllabus scrape failed:", err);
      sendResponse({ success: false, error: err?.message || String(err) });
    }
    return true;
  }
  
  console.log("⚠️ [CONTENT SCRIPT] Unknown message type:", msg.type);
  return false;
});
