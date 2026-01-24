console.log("loaddded");
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
console.log("Sidebar container added:", sidebar);
console.log("Iframe element:", iframe);


console.log("CyAI content script loaded");

console.log("CyAI content script loaded");

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
