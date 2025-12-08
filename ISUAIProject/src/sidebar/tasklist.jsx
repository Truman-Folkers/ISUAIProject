import "./tasklist.css";
import { useState } from "react";
import Chatbot from "./chatbot.jsx";

export default function Tasklist(){
const [tasks, setTasks] = useState([]); // ✅ tasks is defined here

    // Get current page text
async function getPageText() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { action: "readPage" }, (response) => {
      resolve(response.text);
    });
  });
}

async function scanPageForTasks() {
    // Get current page text from content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const pageText = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { action: "readPage" }, (response) => {
        resolve(response.text);
      });
    });

    // Send to backend for task extraction
    const res = await fetch("http://localhost:3000/api/extractTasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: pageText }),
    });

    const data = await res.json();
    setTasks(data.tasks || []);
  }

    return(

 <div className="container">
      <div className="task-section">
        <h3>Tasks</h3>
        <button className="scan-btn" onClick={scanPageForTasks}>
          Scan Page for Tasks
        </button>
        <ul className="task-list">
          {tasks.map((t, i) => (
            <li key={i}>
              <strong>{t.task}</strong> — due {t.due}
            </li>
          ))}
        </ul>
      </div>
</div>

        
    )



}