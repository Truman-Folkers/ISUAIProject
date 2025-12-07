import "./sidebar.css";
import { useState } from "react";
import Chatbot from "./chatbot.jsx";


export default function Sidebar(){
    const [val, setVal] = useState("Ask Cy");
    const [tasks, setTasks] = useState([]); // ✅ tasks is defined here

    const click = () =>{
        //python
    }
    const change = event => {
        //do python
        setVal(event.target.value);
    }
      
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
        <div className="sidebar-container">
      {/* Header */}
      <div className="sidebar-header">
        <h2>CyAI</h2>
      </div>

      {/* Content area */}
      <div className="sidebar-content">
        <p>Welcome to your AI-powered sidebar!</p>
        <p>Use this space to display tools, suggestions, or controls.</p>

        <div className="card">
          <h3>Tool 1</h3>
          <p>Quick description or action here.</p>
        </div>

        <div className="card">
          <h3>Tool 2</h3>
          <p>Another tool description.</p>
        </div>
      </div>

{/* Task List */}
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

      <Chatbot />



        {/* <div className = "input-box">
            <input className = "text-input" onChange = {change} value = {val}></input>
            <button className = "input-button" onClick = {click}>Go</button>
        </div> */}
      {/* Footer */}
      <div className="sidebar-footer">
        <small>© 2025 TruDesign LLC</small>
      </div>
    </div>
        
    )
}