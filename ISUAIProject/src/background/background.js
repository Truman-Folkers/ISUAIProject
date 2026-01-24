console.log("Background script loaded");

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed/updated");
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SEND_TO_AI") {
    fetch("https://your-backend.com/ai/todo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg.payload)
    })
      .then(res => res.json())
      .then(data => sendResponse(data))
      .catch(err => {
        console.error("AI request failed", err);
        sendResponse([]);
      });

    return true; // REQUIRED
  }
});
