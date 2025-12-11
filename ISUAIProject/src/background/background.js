// src/background.js (optional - for extension lifecycle)
console.log("Background script loaded");

// Only needed for extension lifecycle events
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed/updated");
  // Optional: Initialize default settings
  chrome.storage.local.set({ openrouterKey: null });
});

// No message listeners needed for direct API calls