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
    const [courses, setCourses] = useState([]);
    const [loadingCourses, setLoadingCourses] = useState(false);

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

const getCourses = async () => {
  setLoadingCourses(true);
  console.log("🔍 Getting courses...");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log("Active tab:", tab?.url);
    console.log("Tab ID:", tab?.id);
    
    // Send message to the ACTIVE TAB (where content script is running)
    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tab.id,
        { type: "SCRAPE_COURSES" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("❌ Runtime error:", chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log("📬 Response received:", response);
            resolve(response);
          }
        }
      );
    });

    if (response?.success) {
      console.log("✅ Courses found:", response.data);
      setCourses(response.data);
    } else {
      alert("Failed to scrape courses: " + (response?.error || "Unknown error"));
      setCourses([]);
    }
  } catch (err) {
    console.error("❌ Error:", err);
    alert("Error: " + err.message);
    setCourses([]);
  }
  
  setLoadingCourses(false);
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
                    <p>Welcome to your AI-powered sidebar!</p>
                    <p>Use this space to display tools, suggestions, or controls.</p>

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

                    <h4 className = "todo-header">Top 5 To-Do Items</h4>
                    <div className="table">
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
                                    <td>
                                    {t.url ? (
                                        <a href={t.url} target="_blank" rel="noreferrer">
                                        {t.title}
                                        </a>
                                    ) : (
                                        t.title
                                    )}
                                    </td>
                                    <td>{t.course}</td>
                                    <td>{t.due_text}</td>
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
                    

                    <div className="right-side">
                    <div className="card">  
                        <h3>Courses</h3>
                        <button className="generate-button" onClick={getCourses} disabled={loadingCourses} style={{width: '100%', marginBottom: '10px'}}>
                            {loadingCourses ? "Loading…" : "View Courses"}
                        </button>
                        <div className="table">
                            {loadingCourses && <p>Loading courses…</p>}
                            {!loadingCourses && courses.length > 0 && (
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Course</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {courses.map((course, i) => (
                                            <tr key={i}>
                                                <td>
                                                    <a href={course.url} target="_blank" rel="noreferrer">
                                                        {course.name}
                                                    </a>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            {!loadingCourses && courses.length === 0 && (
                                <p>No courses found. Make sure you're on a Canvas page with course links.</p>
                            )}
                        </div>
                    </div>
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
    )
}
