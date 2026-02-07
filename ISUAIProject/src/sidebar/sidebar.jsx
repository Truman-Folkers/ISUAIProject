import "./sidebar.css";
import { useState } from "react";
import Chatbot from "./chatbot.jsx";
import Tasklist from "./tasklist.jsx";

export default function Sidebar({ isCollapsed, onEnter, onLeave, isDarkMode, setIsDarkMode }){

    const [val, setVal] = useState("Ask Cy");

    const click = () => {
        // python
    }

    const change = event => {
        // do python
        setVal(event.target.value);
    }
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(false);

const generateTodos = async () => {
  setLoading(true);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_PAGE" }, (resp) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      setLoading(false);
      return;
    }

    if (!resp?.success) {
      console.error("Scrape failed:", resp?.error || resp);
      setTodos([]);
      setLoading(false);
      return;
    }

    // Directly display scraped Canvas items
    setTodos(resp.data);
    setLoading(false);
  });
};


    const toggleDarkMode = () => {
        setIsDarkMode(!isDarkMode);
    }

    return(
        <div 
            className={`sidebar-container ${isCollapsed ? 'collapsed' : ''} ${isDarkMode ? 'dark-mode' : ''}`}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
        >

            <div className="sidebar-content-wrapper">

                <div className="sidebar-header">
                    {/* Simplified header logic */}
                    <div className="header-flex">
                        <h2>{isCollapsed ? '' : 'CyAI'}</h2>
                        {!isCollapsed && (
                            <button className="dark-mode-toggle" onClick={toggleDarkMode} title="Toggle dark mode">
                                {isDarkMode ? '☀️' : '🌙'}
                            </button>
                        )}
                    </div>
                </div>

                <div className="sidebar-content">
                    {/* <p>Welcome to CyAI!</p>
                    <p>Use this sidebar to ask questions, see your To-Do list, or take a shortcut to your class webpages!</p> */}

                    <div className="separator">
                    <div className="left-side">
                    {/* <div className="table">
                        <thead>
                            <tr>
                                <th>Upcoming Assignments</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <th>Assignment 1</th>
                            </tr>
                        </tbody>
                        <tbody>
                            <tr>
                                <th>Assignment 2</th>
                            </tr>
                        </tbody>
                    </div>
                    </div> */}
                    <button className = "generate-button" onClick={generateTodos} disabled={loading}>
                        {loading ? "Working…" : "Generate To-Do"}
                    </button>

                    <div className = {`todo-card  ${isDarkMode ? 'dark-mode' : ''}`}>
                        <h4 className = "todo-header">Top 5 To-Do Items</h4>
                        <div className="todo-table">
                            {loading && <p>Generating…</p>}

                            {!loading && todos.length > 0 && (
                                <table>
                                <thead>
                                    <tr>
                                    <th>Title</th>
                                    <th>Course</th>
                                    <th>Due</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {todos.slice(0,5).map((t, i) => (
                                    <tr key={i}>
                                        <td className = "todo-title">
                                        {t.url ? (
                                            <a className = "todo-link" href={t.url} target="_blank" rel="noreferrer">
                                            {t.title}
                                            </a>
                                        ) : (
                                            t.title
                                        )}
                                        </td>
                                        <td className = "todo-course">{t.course}</td>
                                        <td className = "todo-due">{t.due_text}</td>
                                    </tr>
                                    ))}
                                </tbody>
                                </table>
                            )}

                            {!loading && todos.length === 0 && (
                                <p>No To Do items found on this page.</p>
                            )}
                        </div>
                    </div>


                    </div>
                    

                    <div className="right-side">
                    <div className="card">  
                        <h3>Tool 1</h3>
                        <p>Temporary description</p>
                    </div>
                    <div className="card">
                        <h3>Tool 2</h3>
                        <p>Another description</p>
                    </div>
                </div>
            </div>
        </div>

        <Chatbot />
      {/* Footer */}
      <div className="sidebar-footer">
        <small>© 2025 TruDesign LLC</small>
      </div>
    </div>
    </div>
        
    )
}
