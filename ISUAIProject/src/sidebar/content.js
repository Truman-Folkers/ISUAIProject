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
