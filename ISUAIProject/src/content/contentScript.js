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

function scrapeAssignments() {
  const nodes = document.querySelectorAll(".assignment");

  if (!nodes.length) {
    console.warn("No assignments found on page");
  }

  return [...nodes].map(el => ({
    title: el.innerText.trim(),
    due: el.querySelector(".due")?.innerText?.trim() || null
  }));
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SCRAPE_PAGE") {
    try {
      const data = scrapeAssignments();
      sendResponse({ success: true, data });
    } catch (err) {
      console.error("Scrape failed:", err);
      sendResponse({ success: false, error: err.message });
    }

    return true;
  }
});
