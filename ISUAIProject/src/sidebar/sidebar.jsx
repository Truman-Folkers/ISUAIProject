import "./sidebar.css";
import { useState, useEffect } from "react";
import Chatbot from "./chatbot.jsx";
import { askDevStral } from "../services/openrouter.js";

const VERSION = "2.0.1";

export default function Sidebar({ isCollapsed, isDarkMode, setIsDarkMode }) {

    // ── State ──────────────────────────────────────────────
    const [activeTab, setActiveTab]               = useState("home");

    // Dashboard
    const [todos, setTodos]                       = useState([]);
    const [todosFetched, setTodosFetched]         = useState(false);
    const [loading, setLoading]                   = useState(false);
    const [courses, setCourses]                   = useState([]);
    const [loadingCourses, setLoadingCourses]     = useState(false);

    // Settings
    const [dashboardCourses, setDashboardCourses] = useState([]);
    const [hiddenCourses, setHiddenCourses]       = useState({});

    // Course page
    const [isCoursePage, setIsCoursePage]         = useState(false);
    const [currentCourseId, setCurrentCourseId]   = useState(null);
    const [summarizing, setSummarizing]           = useState(false);
    const [syllabusContent, setSyllabusContent]   = useState("");

    // ── On Mount ───────────────────────────────────────────
    useEffect(() => {
        chrome.storage.sync.get("hiddenCourses", (data) => {
            if (data.hiddenCourses) setHiddenCourses(data.hiddenCourses);
        });

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;
            const url = tabs[0].url;
            const match = url.match(/\/courses\/(\d+)/);
            if (match && !url.includes("/settings") && !url.includes("/grades")) {
                setIsCoursePage(true);
                setCurrentCourseId(match[1]);
            } else {
                setIsCoursePage(false);
                setCurrentCourseId(null);
            }
        });
    }, []);

    // ── Helper: send message to active tab ─────────────────
    const sendTabMessage = (type, extra = {}) =>
        new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs[0]) return reject(new Error("No active tab"));
                chrome.tabs.sendMessage(tabs[0].id, { type, ...extra }, (resp) => {
                    if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
                    resolve(resp);
                });
            });
        });

    // ── Dashboard Actions ──────────────────────────────────
    const generateTodos = async () => {
        if (todos.length > 0) { setTodos([]); setTodosFetched(false); return; }
        setLoading(true);
        try {
            const resp = await sendTabMessage("SCRAPE_PAGE");
            setTodos(resp?.success ? resp.data : []);
        } catch (err) {
            console.error("generateTodos error:", err);
            setTodos([]);
        }
        setTodosFetched(true);
        setLoading(false);
    };

    const getCourses = async () => {
        if (courses.length > 0) { setCourses([]); return; }
        setLoadingCourses(true);
        try {
            const resp = await sendTabMessage("GET_DASHBOARD_COURSES");
            setCourses(resp?.success ? resp.data : []);
        } catch (err) {
            console.error("getCourses error:", err);
            setCourses([]);
        }
        setLoadingCourses(false);
    };

    // ── Settings Actions ───────────────────────────────────
    const loadDashboardCourses = async () => {
        try {
            const resp = await sendTabMessage("GET_DASHBOARD_COURSES");
            if (resp?.success) {
                setDashboardCourses(resp.data);
                chrome.storage.sync.get("hiddenCourses", (data) => {
                    if (data.hiddenCourses) setHiddenCourses(data.hiddenCourses);
                });
            }
        } catch (err) {
            console.error("loadDashboardCourses error:", err);
        }
    };

    const toggleCourseVisibility = (courseId) => {
        const updated = { ...hiddenCourses, [courseId]: !hiddenCourses[courseId] };
        setHiddenCourses(updated);
        chrome.storage.sync.set({ hiddenCourses: updated });
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: "APPLY_COURSE_VISIBILITY", hiddenCourses: updated });
        });
    };

    // ── Course Page Actions ────────────────────────────────
    const summarizeSyllabus = async () => {
        setSummarizing(true);
        setSyllabusContent("");
        try {
            const resp = await sendTabMessage("SCRAPE_SYLLABUS", { courseId: currentCourseId });
            if (resp?.success && resp.data && resp.data.length > 50 && !resp.data.includes("No syllabus content found")) {
                const prompt = `Please analyze this course syllabus and extract the following information. Format your response EXACTLY as shown:

SYLLABUS SUMMARY
================

1) DUE DATES:
[List all due dates and deadlines]

2) GRADING BREAKDOWN:
[How grades are calculated with percentages]

3) MAJOR ASSIGNMENTS:
[Significant assignments, projects, exams]

4) INSTRUCTOR CONTACT:
[Name, email, office hours]

---
SYLLABUS TEXT:
${resp.data}`;
                setSyllabusContent(await askDevStral(prompt));
            } else {
                setSyllabusContent("No syllabus content detected for this course.");
            }
        } catch (err) {
            console.error("summarizeSyllabus error:", err);
            setSyllabusContent("Error summarizing syllabus: " + err.message);
        }
        setSummarizing(false);
    };


    // ── Render ─────────────────────────────────────────────
    return (
        <div className={`sidebar-container ${isCollapsed ? "collapsed" : ""} ${isDarkMode ? "dark-mode" : ""}`}>
            <div className="sidebar-content-wrapper">

                {/* ── Header ── */}
                <div className={`sidebar-header ${isCoursePage ? "course-header" : ""}`}>
                    <div className="header-flex">
                        <h2>{isCollapsed ? "" : "CyAI"}</h2>
                        {!isCollapsed && (
                            <>
                                <button className="dark-mode-toggle" onClick={() => setIsDarkMode(!isDarkMode)} title="Toggle dark mode">
                                    {isDarkMode ? "☀️" : "🌙"}
                                </button>
                                <button className="settings-toggle" onClick={() => setActiveTab(activeTab === "home" ? "settings" : "home")} title="Settings">
                                    ⚙️
                                </button>
                            </>
                        )}
                    </div>
                    {!isCollapsed && (
                        <div className={`page-context-banner ${isCoursePage ? "course-banner" : "home-banner"}`}>
                            {isCoursePage ? "📖 Course Page" : "🏠 Dashboard"}
                        </div>
                    )}
                </div>

                {/* ── Body ── */}
                <div className="sidebar-content">

                    {/* Settings Tab */}
                    {activeTab === "settings" && (
                        <div className="settings-view">
                            <h3>Settings</h3>
                            {!isCoursePage && (
                                <>
                                    <p className="settings-subtitle">Hide courses from your Canvas dashboard:</p>
                                    <button className="generate-button" onClick={loadDashboardCourses} style={{ width: "100%", marginBottom: "10px" }}>
                                        Load Dashboard Courses
                                    </button>
                                    {dashboardCourses.length > 0 ? (
                                        <div className="settings-course-list">
                                            {dashboardCourses.map((course) => (
                                                <label key={course.id} className={`settings-course-item ${isDarkMode ? "dark" : ""}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={!hiddenCourses[course.id]}
                                                        onChange={() => toggleCourseVisibility(course.id)}
                                                    />
                                                    <span>{course.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="settings-empty">Click "Load Dashboard Courses" to get started</p>
                                    )}
                                </>
                            )}
                            {isCoursePage && (
                                <p className="settings-empty">More course settings coming soon!</p>
                            )}
                        </div>
                    )}

                    {/* Home Tab — Course Page */}
                    {activeTab === "home" && isCoursePage && (
                        <div className="course-page-view">
                            <div className="course-page-card">
                                <h3>Course Tools</h3>
                                <p className="course-page-subtitle">You're viewing a course. Use the tools below to help you study.</p>
                                <button className="generate-button" onClick={summarizeSyllabus} disabled={summarizing} style={{ width: "100%" }}>
                                    {summarizing ? "⏳ Summarizing…" : "📄 Summarize Syllabus"}
                                </button>
                                {syllabusContent && (
                                    <textarea
                                        value={syllabusContent}
                                        readOnly
                                        className={`syllabus-output ${isDarkMode ? "dark" : ""}`}
                                    />
                                )}
                                <div>
                              <h3>Generate To-Do List</h3>
                              <button className="generate-button" onClick={generateTodos} disabled={loading} style={{width: '100%'}}>
                                {loading ? "Working…" : todos.length > 0 ? "Hide To-Do" : "Generate To-Do"}
                              </button>

                              {todosFetched && (
                                <div className={`todo-card ${isDarkMode ? 'dark-mode' : ''}`} style={{marginTop: '10px'}}>
                                  <h4 className="todo-header">Top 5 To-Do Items</h4>
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
                                          {todos.slice(0, 5).map((t, i) => (
                                          <tr key={i}>
                                            <td className="todo-title">
                                              {t.url ? (
                                              <a className="todo-link" href={t.url} target="_blank" rel="noreferrer">
                                                {t.title}
                                              </a>
                                              ) : (
                                                t.title
                                              )}
                                            </td>
                                            <td className="todo-course">{t.course}</td>
                                            <td className="todo-due">{t.due_text}</td>
                                          </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      )}

                                      {!loading && todos.length === 0 && (
                                        <p>No upcoming To-Do items found.</p>
                                      )}
                                    </div>
                                  </div>
                                  )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Home Tab — Dashboard */}
                    {activeTab === "home" && !isCoursePage && (
                        <div className="home-page-view">
                            <p className="welcome-text">Welcome to <strong>CyAI</strong>!</p>
                            <p className="welcome-sub">Ask questions, see your To-Do list, or jump to a course.</p>

                            <div className="home-actions">

                                {/* Go to Course */}
                                <div>
                                    <button className="generate-button" onClick={getCourses} disabled={loadingCourses} style={{ width: "100%" }}>
                                        {loadingCourses ? "Loading…" : courses.length > 0 ? "Hide Courses" : "🎓 Go to Course"}
                                    </button>
                                    {!loadingCourses && courses.length > 0 && (
                                        <div className="courses-list">
                                            <h4>Your Courses:</h4>
                                            <ul>
                                                {courses.filter((c) => !hiddenCourses[c.id]).map((course) => (
                                                    <li key={course.id}>
                                                        <a href={course.url} target="_blank" rel="noreferrer" className="todo-link">
                                                            {course.name}
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                            {courses.filter((c) => !hiddenCourses[c.id]).length === 0 && (
                                                <p className="empty-note">All courses are hidden in settings</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Generate To-Do */}
                                <div>
                                    <button className="generate-button" onClick={generateTodos} disabled={loading} style={{ width: "100%" }}>
                                        {loading ? "Working…" : todos.length > 0 ? "Hide To-Do" : "📝 Generate To-Do"}
                                    </button>
                                    {todosFetched && (
                                        <div className={`todo-card ${isDarkMode ? "dark-mode" : ""}`}>
                                            <h4 className="todo-header">Top 5 To-Do Items</h4>
                                            <div className="todo-table">
                                                {loading && <p>Generating…</p>}
                                                {!loading && todos.length === 0 && <p>No upcoming To-Do items found.</p>}
                                                {!loading && todos.length > 0 && (
                                                    <table>
                                                        <thead>
                                                            <tr><th>Title</th><th>Course</th><th>Due</th></tr>
                                                        </thead>
                                                        <tbody>
                                                            {todos.slice(0, 5).map((t, i) => (
                                                                <tr key={i}>
                                                                    <td className="todo-title">
                                                                        {t.url
                                                                            ? <a className="todo-link" href={t.url} target="_blank" rel="noreferrer">{t.title}</a>
                                                                            : t.title}
                                                                    </td>
                                                                    <td className="todo-course">{t.course}</td>
                                                                    <td className="todo-due">{t.due_text}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    )}

                </div>
            </div>

            <Chatbot />

            <div className="sidebar-footer">
                <small>© 2025 TruDesign LLC | v{VERSION}</small>
            </div>
        </div>
    );
}
