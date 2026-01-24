// src/background.js (optional - for extension lifecycle)
console.log("Background script loaded");

// Only needed for extension lifecycle events
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed/updated");
  // Optional: Initialize default settings
  chrome.storage.local.set({ openrouterKey: null });
});

// No message listeners needed for direct API calls

// background.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SCRAPED_DATA") {
    fetch("https://your-backend.com/ai/todo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg.payload)
    })
      .then(res => res.json())
      .then(data => sendResponse(data));
  }

  return true; // async
});
