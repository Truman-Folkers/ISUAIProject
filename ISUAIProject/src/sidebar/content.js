// Reads all visible text from the page
function readPageText() {
    return [...document.querySelectorAll(".assignment")].map(a => ({
    title: a.innerText,
    due: a.querySelector(".due")?.innerText ?? null
  }));
}

chrome.runtime.sendMessage({
  type: "SCRAPED_DATA",
  payload: readPageText()
});