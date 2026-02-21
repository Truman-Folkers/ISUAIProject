console.log("CyAI contentScript.js loaded");

/* =========================
   Sidebar Injection
========================= */

// Wait for document.body to be ready
if (!document.body) {
  console.warn("⚠️ document.body not ready, waiting...");
  document.addEventListener("DOMContentLoaded", initSidebar);
} else {
  initSidebar();
}

function initSidebar() {
  console.log("✅ Initializing sidebar...");
  
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

  document.body.appendChild(sidebar);
  console.log("✅ Sidebar div appended to body");

  const iframeUrl = chrome.runtime.getURL("src/sidebar/index.html");
  console.log("📍 Loading iframe from:", iframeUrl);

  const iframe = document.createElement("iframe");
  iframe.src = iframeUrl;
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.style.overflow = "hidden";
  iframe.style.pointerEvents = "none"; // disabled until sidebar expands

  iframe.onload = () => {
    console.log("✅ Iframe loaded successfully");
  };

  iframe.onerror = (err) => {
    console.error("❌ Iframe load error:", err);
  };

  sidebar.appendChild(iframe);
  console.log("✅ Iframe appended to sidebar");

  // Load and apply hidden courses on page load
  chrome.storage.sync.get("hiddenCourses", (data) => {
    if (data.hiddenCourses) {
      console.log("📦 Loaded hidden courses from storage:", data.hiddenCourses);
      applyDashboardCourseVisibility(data.hiddenCourses);
    } else {
      console.log("ℹ️ No hidden courses in storage");
    }
  });
}

/* =========================
   Canvas To-Do Scraper
========================= */

async function scrapeCanvasTodoSidebar() {
  const domain = window.location.origin;

  // --- Strategy 1: Canvas Planner API (most reliable) ---
  try {
    const today = new Date().toISOString();
    const apiUrl = `${domain}/api/v1/planner/items?start_date=${today}&per_page=20&order=asc`;
    const resp = await fetch(apiUrl, { credentials: "include" });

    if (resp.ok) {
      const items = await resp.json();
      console.log("✅ Planner API returned", items.length, "items");

      return items
        .filter(item => item.plannable_type !== "announcement")
        .slice(0, 5)
        .map(item => {
          const plannable = item.plannable || {};
          const courseId = item.course_id || item.plannable?.course_id;
          const title = plannable.title || item.plannable_id || "Untitled";
          const dueAt = plannable.due_at || plannable.todo_date || item.plannable_date;
          const due_text = dueAt
            ? new Date(dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
            : "No due date";

          // Build URL from context_name or course_id
          let url = null;
          const type = item.plannable_type; // "assignment", "quiz", "discussion_topic", etc.
          if (courseId && item.plannable_id) {
            const typeMap = {
              assignment: "assignments",
              quiz: "quizzes",
              discussion_topic: "discussion_topics",
            };
            const segment = typeMap[type] || "assignments";
            url = `${domain}/courses/${courseId}/${segment}/${item.plannable_id}`;
          }

          return {
            title,
            course: item.context_name || null,
            due_text,
            url,
          };
        });
    }
    console.warn("⚠️ Planner API failed:", resp.status);
  } catch (err) {
    console.warn("⚠️ Planner API error:", err);
  }

  // --- Strategy 2: Broader DOM scrape fallback ---
  console.log("🔄 Falling back to DOM scrape...");
  const results = [];
  const seen = new Set();

  // Try any link that points to an assignment, quiz, or discussion
  const links = document.querySelectorAll(
    "a[href*='/assignments/'], a[href*='/quizzes/'], a[href*='/discussion_topics/']"
  );

  for (const link of links) {
    const href = link.getAttribute("href") || "";
    if (!href || seen.has(href)) continue;
    seen.add(href);

    const title = link.innerText?.trim();
    if (!title) continue;

    try {
      const url = new URL(href, domain).toString();
      results.push({ title, course: null, due_text: null, url });
    } catch (_) { /* skip bad URLs */ }

    if (results.length >= 5) break;
  }

  console.log("📋 DOM fallback found", results.length, "items");
  return results;
}

/* =========================
   Message Listener
========================= */



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
    scrapeCanvasTodoSidebar()
      .then(data => {
        console.log("✅ SCRAPE_PAGE successful, sending data:", data.length, "items");
        sendResponse({ success: true, data });
      })
      .catch(err => {
        console.error("❌ Scrape failed:", err);
        sendResponse({ success: false, error: err?.message || String(err) });
      });
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
