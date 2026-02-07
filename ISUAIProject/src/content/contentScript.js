console.log("CyAI contentScript.js loaded");

/* =========================
   Sidebar Injection
========================= */

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

sidebar.addEventListener("mouseenter", () => {
  sidebar.style.width = "34vh";
});
sidebar.addEventListener("mouseleave", () => {
  sidebar.style.width = "50px";
});

document.body.appendChild(sidebar);

const iframe = document.createElement("iframe");
iframe.src = chrome.runtime.getURL("src/sidebar/index.html");
iframe.style.width = "100%";
iframe.style.height = "100%";
iframe.style.border = "none";

sidebar.appendChild(iframe);

/* =========================
   Canvas To-Do Scraper
========================= */

function scrapeCanvasTodoSidebar() {
  const list = document.querySelector("#planner-todosidebar-item-list");
  if (!list) return [];

  const items = [...list.querySelectorAll("li")];

  return items
    .map((li) => {
      const root = li.querySelector(".ToDoSidebarItem") || li;

      // ❌ Skip announcements
      if (root.querySelector('svg[label="Announcement"]')) return null;

      const titleLink =
        root.querySelector(".ToDoSidebarItem__Title a") ||
        root.querySelector("a");

      if (!titleLink) return null;

      const href = titleLink.getAttribute("href") || "";

      // ❌ Only assignments
      if (!href.includes("/assignments/")) return null;

      const title =
        titleLink.querySelector("span")?.innerText?.trim() ||
        titleLink.innerText?.trim();

      const url = new URL(href, window.location.origin).toString();

      const course =
        root.querySelector(".ToDoSidebarItem__Info > span")?.innerText?.trim() ||
        null;

      const infoRow =
        root.querySelector('[data-testid="ToDoSidebarItem__InformationRow"]') ||
        root.querySelector(".ToDoSidebarItem__InformationRow");

      let due_text = null;

      if (infoRow) {
        const lis = [...infoRow.querySelectorAll("li")];

        const dateLi = lis.find(li =>
          !li.innerText.toLowerCase().includes("point")
        );

        due_text = dateLi?.innerText.trim() || null;
      }

      return { title, course, due_text, url };
    })
    .filter(Boolean)
    .slice(0, 5); // ✅ TOP 5 ONLY
}

/* =========================
   Message Listener
========================= */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SCRAPE_PAGE") {
    try {
      const data = scrapeCanvasTodoSidebar();
      sendResponse({ success: true, data });
    } catch (err) {
      console.error("Scrape failed:", err);
      sendResponse({ success: false, error: err?.message || String(err) });
    }
    return true;
  }
});
