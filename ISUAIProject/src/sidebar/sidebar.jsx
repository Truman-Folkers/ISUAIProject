import "./sidebar.css";
import { useState, useEffect } from "react";
import Chatbot from "./chatbot.jsx";
import Tasklist from "./tasklist.jsx";

const VERSION = "1.0.0";

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
    const [selectedCourses, setSelectedCourses] = useState({});
    const [activeTab, setActiveTab] = useState("home"); // "home", "settings"
    const [dashboardCourses, setDashboardCourses] = useState([]);
    const [hiddenCourses, setHiddenCourses] = useState({});
    const [isCoursePage, setIsCoursePage] = useState(false);
    const [currentCourseId, setCurrentCourseId] = useState(null);
    const [summarizingCourse, setSummarizingCourse] = useState(false);
    const [syllabusContent, setSyllabusContent] = useState("");

    // Load hidden courses on component mount
    useEffect(() => {
      chrome.storage.sync.get("hiddenCourses", (data) => {
        if (data.hiddenCourses) {
          console.log("✅ Loaded hidden courses on startup:", data.hiddenCourses);
          setHiddenCourses(data.hiddenCourses);
        }
      });
    }, []);

    // Detect if we're on a course page
    useEffect(() => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          const url = tabs[0].url;
          console.log("📍 Current URL:", url);
          
          // Check if URL matches course page pattern: /courses/[id]
          const courseMatch = url.match(/\/courses\/(\d+)/);
          if (courseMatch && !url.includes("/settings") && !url.includes("/grades")) {
            const courseId = courseMatch[1];
            console.log("✅ On course page:", courseId);
            setIsCoursePage(true);
            setCurrentCourseId(courseId);
          } else {
            setIsCoursePage(false);
            setCurrentCourseId(null);
          }
        }
      });
    }, []);

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
  console.log("🔍 Getting dashboard courses...");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log("Active tab:", tab?.url);
    console.log("Tab ID:", tab?.id);
    
    // Send message to scrape dashboard courses
    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tab.id,
        { type: "GET_DASHBOARD_COURSES" },
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
      console.log("✅ Dashboard courses found:", response.data);
      setCourses(response.data);
    } else {
      alert("Failed to get courses: " + (response?.error || "Unknown error"));
      setCourses([]);
    }
  } catch (err) {
    console.error("❌ Error:", err);
    alert("Error: " + err.message);
    setCourses([]);
  }
  
  setLoadingCourses(false);
};

const toggleCourseSelection = (courseId) => {
  const updated = { ...selectedCourses };
  updated[courseId] = !updated[courseId];
  setSelectedCourses(updated);
  
  // Save to chrome storage
  chrome.storage.sync.set({ selectedCourses: updated });
  console.log("💾 Saved course preferences:", updated);
};

const loadDashboardCourses = async () => {
  console.log("🔍 Loading dashboard courses for settings...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tab.id,
        { type: "GET_DASHBOARD_COURSES" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("❌ Runtime error:", chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    });

    if (response?.success) {
      console.log("✅ Dashboard courses found:", response.data);
      setDashboardCourses(response.data);
      
      // Load saved hidden courses
      chrome.storage.sync.get("hiddenCourses", (data) => {
        if (data.hiddenCourses) {
          console.log("✅ Loaded hidden courses:", data.hiddenCourses);
          setHiddenCourses(data.hiddenCourses);
        }
      });
    } else {
      alert("Failed to load dashboard courses: " + (response?.error || "Unknown error"));
    }
  } catch (err) {
    console.error("❌ Error:", err);
    alert("Error: " + err.message);
  }
};

const toggleCourseVisibility = (courseId) => {
  const updated = { ...hiddenCourses };
  updated[courseId] = !updated[courseId];
  setHiddenCourses(updated);
  
  // Save to chrome storage
  chrome.storage.sync.set({ hiddenCourses: updated });
  console.log("💾 Saved hidden courses:", updated);
  
  // Tell content script to update the dashboard
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        type: "APPLY_COURSE_VISIBILITY", 
        hiddenCourses: updated 
      });
    }
  });
};

const summarizeSyllabus = async () => {
  setSummarizingCourse(true);
  setSyllabusContent("");
  console.log("📄 Summarizing syllabus for course:", currentCourseId);
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tab.id,
        { type: "SCRAPE_SYLLABUS", courseId: currentCourseId },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("❌ Runtime error:", chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    });
    
    if (response?.success && response.data) {
      console.log("✅ Syllabus scraped, processing with AI...");
      
      // Check if meaningful content was found
      if (response.data.length < 50 || response.data.includes("No syllabus content found")) {
        setSyllabusContent("No syllabus detected");
      } else {
        // Send to AI for summarization
        try {
          const aiSummary = await summarizeWithAI(response.data);
          setSyllabusContent(aiSummary);
        } catch (aiErr) {
          console.error("❌ AI Error:", aiErr);
          setSyllabusContent("Failed to process syllabus. Please ensure you have configured an API key.");
        }
      }
    } else {
      setSyllabusContent("No syllabus detected");
    }
  } catch (err) {
    console.error("❌ Error:", err);
    setSyllabusContent("Error: " + err.message);
  }
  
  setSummarizingCourse(false);
};

const summarizeWithAI = async (syllabusText) => {
  console.log("🤖 Calling OpenRouter Devstral to summarize...");
  
  const prompt = `Please analyze this course syllabus and extract the following information. Format your response EXACTLY as shown below with clear sections:

SYLLABUS SUMMARY
================

1) DUE DATES:
[List all mentioned due dates, deadlines, or key dates]

2) GRADING BREAKDOWN:
[How grades are calculated - include percentages if mentioned]

3) MAJOR ASSIGNMENTS:
[List significant assignments, projects, exams, etc.]

4) INSTRUCTOR CONTACT:
[Instructor name, email, office hours, phone if available]

---

SYLLABUS TEXT:
${syllabusText}`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://canvas.instructure.com",
        "X-Title": "CyAI",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct:free",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("❌ OpenRouter Error:", error);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('No response from AI');
    }

    return data.choices[0].message.content;
  } catch (err) {
    console.error("❌ AI Error:", err);
    throw err;
  }
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
                            <>
                                <button className="dark-mode-toggle" onClick={toggleDarkMode} title="Toggle dark mode">
                                    {isDarkMode ? '☀️' : '🌙'}
                                </button>
                                <button className="settings-toggle" onClick={() => setActiveTab(activeTab === 'home' ? 'settings' : 'home')} title="Settings" style={{marginLeft: '8px'}}>
                                    ⚙️
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="sidebar-content">
                    {isCoursePage && activeTab === 'home' && (
                        <>
                            <h3>Course Tools</h3>
                            
                            <button className="generate-button" onClick={summarizeSyllabus} disabled={summarizingCourse} style={{width: '100%', marginBottom: '15px'}}>
                                {summarizingCourse ? "Summarizing…" : "📄 Summarize Syllabus"}
                            </button>
                            
                            {syllabusContent && syllabusContent.trim() && (
                                <div style={{marginBottom: '15px'}}>
                                    <textarea
                                        value={syllabusContent}
                                        readOnly
                                        style={{
                                            width: '100%',
                                            height: '300px',
                                            padding: '10px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            fontFamily: 'monospace',
                                            fontSize: '11px',
                                            backgroundColor: isDarkMode ? '#222' : '#f9f9f9',
                                            color: isDarkMode ? '#ddd' : '#333',
                                            resize: 'vertical'
                                        }}
                                    />
                                </div>
                            )}
                            
                            <hr style={{margin: '15px 0', border: 'none', borderTop: '1px solid #ddd'}} />
                        </>
                    )}
                    
                    {activeTab === 'home' ? (
                        <>
                            {!isCoursePage && (
                                <>
                                    <p>Welcome to CyAI!</p>
                                    <p>Use this sidebar to ask questions, see your To-Do list, or take a shortcut to your class webpages!</p>
                                </>
                            )}

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
                            {!isCoursePage && (
                                <button className = "generate-button" onClick={generateTodos} disabled={loading}>
                                    {loading ? "Working…" : "Generate To-Do"}
                                </button>
                            )}

                            {!isCoursePage && (
                                <h4 className = "todo-header">Top 5 To-Do Items</h4>
                            )}
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
                                                <a className = "todo-link" href={t.url} target="_blank" rel="noreferrer">
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

                                {!loading && todos.length === 0 && !isCoursePage && (
                                    <p>No To Do items found on this page.</p>
                                )}
                            </div>


                            </div>
                            

                            <div className="right-side">
                            <div className="card">  
                                {!isCoursePage && (
                                    <button className="generate-button" onClick={getCourses} disabled={loadingCourses} style={{width: '100%', marginBottom: '10px'}}>
                                        {loadingCourses ? "Loading…" : "Go to Course"}
                                    </button>
                                )}
                                
                                {loadingCourses && <p>Loading courses…</p>}
                                
                                {!loadingCourses && courses.length > 0 && (
                                    <div className="courses-list">
                                        <h4 style={{marginTop: '0', marginBottom: '10px'}}>Your Courses:</h4>
                                        <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                                            {courses.filter(course => !hiddenCourses[course.id]).map((course) => (
                                                <li key={course.id} style={{marginBottom: '8px'}}>
                                                    <a 
                                                        href={course.url} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        className="todo-link"
                                                    >
                                                        {course.name}
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                        {courses.filter(course => !hiddenCourses[course.id]).length === 0 && (
                                            <p style={{fontSize: '11px', color: '#999', marginTop: '8px'}}>All courses are hidden in settings</p>
                                        )}
                                    </div>
                                )}
                                
                                {!loadingCourses && courses.length === 0 && !isCoursePage && (
                                    <p style={{fontSize: '12px', color: '#666', marginTop: '10px'}}>Click button to load courses</p>
                                )}
                            </div>
                            </div>

                            </div>
                        </>
                    ) : (
                        <div>
                            <h3>Dashboard Settings</h3>
                            <p style={{fontSize: '12px', color: '#666', marginBottom: '15px'}}>Hide courses from your Canvas dashboard:</p>
                            
                            <button className="generate-button" onClick={loadDashboardCourses} style={{width: '100%', marginBottom: '10px'}}>
                                Load Dashboard Courses
                            </button>
                            
                            {dashboardCourses.length > 0 && (
                                <div style={{maxHeight: '400px', overflowY: 'auto', fontSize: '12px'}}>
                                    {dashboardCourses.map((course) => (
                                        <label key={course.id} style={{display: 'flex', alignItems: 'center', marginBottom: '10px', cursor: 'pointer', padding: '8px', backgroundColor: isDarkMode ? '#333' : '#f5f5f5', borderRadius: '4px'}}>
                                            <input 
                                                type="checkbox" 
                                                checked={!hiddenCourses[course.id]}
                                                onChange={() => toggleCourseVisibility(course.id)}
                                                style={{marginRight: '8px', cursor: 'pointer'}}
                                            />
                                            <span style={{flex: 1}}>{course.name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                            
                            {dashboardCourses.length === 0 && (
                                <p style={{fontSize: '12px', color: '#666'}}>Click "Load Dashboard Courses" to get started</p>
                            )}
                        </div>
                    )}
                </div>

        </div>

        <Chatbot />
        {/* Footer */}
        <div className="sidebar-footer">
          <small>© 2025 TruDesign LLC | v{VERSION}</small>
        </div>
      </div>
    )
}
