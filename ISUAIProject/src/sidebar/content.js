// Reads all visible text from the page
function readPageText() {
  return document.body.innerText;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "readPage") {
    const text = readPageText();
    sendResponse({ text });
  }
});
