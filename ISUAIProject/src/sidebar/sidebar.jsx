import "./sidebar.css";
import { useState, useEffect } from "react";
import Chatbot from "./chatbot.jsx";
import { askDevStral } from "../services/openrouter.js";
import { getCanvasSyncMetadata } from "./canvasKnowledge.js";

const VERSION = "2.1.0";

export default function Sidebar({ isCollapsed, isDarkMode, setIsDarkMode }) {
  const [activeTab, setActiveTab] = useState("home");

  const [todos, setTodos] = useState([]);
  const [todosFetched, setTodosFetched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  const [dashboardCourses, setDashboardCourses] = useState([]);
  const [hiddenCourses, setHiddenCourses] = useState({});

  const [isCoursePage, setIsCoursePage] = useState(false);
  const [currentCourseId, setCurrentCourseId] = useState(null);
  const [summarizing, setSummarizing] = useState(false);
  const [syllabusContent, setSyllabusContent] = useState("");

  const [syncingCanvas, setSyncingCanvas] = useState(false);
  const [canvasSyncStatus, setCanvasSyncStatus] = useState("");
  const [canvasMeta, setCanvasMeta] = useState(null);

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

  const loadCanvasMeta = async () => {
    try {
      const meta = await getCanvasSyncMetadata();
      setCanvasMeta(meta);
    } catch {
      setCanvasMeta(null);
    }
  };

  useEffect(() => {
    chrome.storage.sync.get("hiddenCourses", (data) => {
      if (data.hiddenCourses) setHiddenCourses(data.hiddenCourses);
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      const url = tabs[0].url || "";
      const match = url.match(/\/courses\/(\d+)/);
      if (match && !url.includes("/settings") && !url.includes("/grades")) {
        setIsCoursePage(true);
        setCurrentCourseId(match[1]);
      } else {
        setIsCoursePage(false);
        setCurrentCourseId(null);
      }
    });

    loadCanvasMeta();

    const onRuntimeMessage = (msg) => {
      if (msg?.type !== "CANVAS_SYNC_PROGRESS") return;
      if (msg.stage === "sync_complete") {
        setCanvasSyncStatus(`Sync complete (${msg.courseCount || 0} courses indexed)`);
        loadCanvasMeta();
        return;
      }
      const detail = msg.detail || msg.stage || "Syncing Canvas data";
      setCanvasSyncStatus(detail);
    };

    chrome.runtime.onMessage.addListener(onRuntimeMessage);
    return () => chrome.runtime.onMessage.removeListener(onRuntimeMessage);
  }, []);

  const formatDateTime = (iso) => {
    if (!iso) return "Never";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return d.toLocaleString();
  };

  const syncCanvasData = async () => {
    if (syncingCanvas) return;
    setSyncingCanvas(true);
    setCanvasSyncStatus("Syncing courses...");

    try {
      const contextResp = await sendTabMessage("GET_CANVAS_PAGE_CONTEXT");
      if (!contextResp?.success || !contextResp?.data?.isCanvas) {
        throw new Error("Open a Canvas page first to sync data.");
      }

      const resp = await sendTabMessage("SYNC_CANVAS_DATA");
      if (!resp?.success) {
        throw new Error(resp?.error || "Canvas sync failed");
      }

      const count = resp.data?.courseCount || resp.data?.courses?.length || 0;
      const failed = resp.data?.failedCourses?.length || 0;
      setCanvasSyncStatus(
        failed > 0
          ? `Sync complete with ${failed} course failures (${count} indexed)`
          : `Sync complete (${count} courses indexed)`
      );
      await loadCanvasMeta();
    } catch (err) {
      setCanvasSyncStatus(`Sync failed: ${err.message || String(err)}`);
    } finally {
      setSyncingCanvas(false);
    }
  };

  const generateTodos = async () => {
    if (todos.length > 0) {
      setTodos([]);
      setTodosFetched(false);
      return;
    }
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
    if (courses.length > 0) {
      setCourses([]);
      return;
    }
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
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "APPLY_COURSE_VISIBILITY",
          hiddenCourses: updated,
        });
      }
    });
  };

  const summarizeSyllabus = async () => {
    setSummarizing(true);
    setSyllabusContent("");
    try {
      const resp = await sendTabMessage("SCRAPE_SYLLABUS", { courseId: currentCourseId });
      if (resp?.success && resp.data && resp.data.length > 50 && !resp.data.includes("No syllabus content found")) {
        const prompt = `Please analyze this course syllabus and extract the following information. Format your response EXACTLY as shown:\n\nSYLLABUS SUMMARY\n================\n\n1) DUE DATES:\n[List all due dates and deadlines]\n\n2) GRADING BREAKDOWN:\n[How grades are calculated with percentages]\n\n3) MAJOR ASSIGNMENTS:\n[Significant assignments, projects, exams]\n\n4) INSTRUCTOR CONTACT:\n[Name, email, office hours]\n\n---\nSYLLABUS TEXT:\n${resp.data}`;
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

  const syncPanel = (
    <div className={`sync-card ${isDarkMode ? "dark" : ""}`}>
      <div className="sync-card-header">
        <strong>Canvas Sync</strong>
        <button className="generate-button" onClick={syncCanvasData} disabled={syncingCanvas}>
          {syncingCanvas ? "Syncing..." : "Sync Canvas Data"}
        </button>
      </div>
      <p className="sync-line">Last synced: {formatDateTime(canvasMeta?.syncedAt)}</p>
      <p className="sync-line">Indexed courses: {canvasMeta?.courseCount ?? 0}</p>
      {canvasMeta?.failedCount ? <p className="sync-line">Failed courses: {canvasMeta.failedCount}</p> : null}
      {canvasSyncStatus ? <p className="sync-status">{canvasSyncStatus}</p> : null}
    </div>
  );

  return (
    <div className={`sidebar-container ${isCollapsed ? "collapsed" : ""} ${isDarkMode ? "dark-mode" : ""}`}>
      <div className="sidebar-content-wrapper">
        <div className={`sidebar-header ${isCoursePage ? "course-header" : ""}`}>
          <div className="header-flex">
            <h2>{isCollapsed ? "" : "CyAI"}</h2>
            {!isCollapsed && (
              <>
                <button className="dark-mode-toggle" onClick={() => setIsDarkMode(!isDarkMode)} title="Toggle dark mode">
                  {isDarkMode ? "☀️" : "🌙"}
                </button>
                <button className="settings-toggle" onClick={() => setActiveTab(activeTab === "home" ? "settings" : "home")} title="Settings">
                  S
                </button>
              </>
            )}
          </div>
          {!isCollapsed && (
            <div className={`page-context-banner ${isCoursePage ? "course-banner" : "home-banner"}`}>
              {isCoursePage ? "Course Page" : "Dashboard"}
            </div>
          )}
        </div>

        <div className="sidebar-content">
          {activeTab === "settings" && (
            <div className="settings-view">
              <h3>Settings</h3>
              {syncPanel}
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
                          <input type="checkbox" checked={!hiddenCourses[course.id]} onChange={() => toggleCourseVisibility(course.id)} />
                          <span>{course.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="settings-empty">Click "Load Dashboard Courses" to get started</p>
                  )}
                </>
              )}
              {isCoursePage && <p className="settings-empty">More course settings coming soon!</p>}
            </div>
          )}

          {activeTab === "home" && isCoursePage && (
            <div className="course-page-view">
              {syncPanel}
              <div className="course-page-card">
                <h3>Course Tools</h3>
                <p className="course-page-subtitle">You are viewing a course. Use the tools below to help you study.</p>
                <button className="generate-button" onClick={summarizeSyllabus} disabled={summarizing} style={{ width: "100%" }}>
                  {summarizing ? "Summarizing..." : "Summarize Syllabus"}
                </button>
                {syllabusContent && <textarea value={syllabusContent} readOnly className={`syllabus-output ${isDarkMode ? "dark" : ""}`} />}
              </div>
            </div>
          )}

          {activeTab === "home" && !isCoursePage && (
            <div className="home-page-view">
              <p className="welcome-text">
                Welcome to <strong>CyAI</strong>!
              </p>
              <p className="welcome-sub">Ask questions, sync Canvas data, see your To-Do list, or jump to a course.</p>

              {syncPanel}

              <div className="home-actions">
                <div>
                  <button className="generate-button" onClick={getCourses} disabled={loadingCourses} style={{ width: "100%" }}>
                    {loadingCourses ? "Loading..." : courses.length > 0 ? "Hide Courses" : "Go to Course"}
                  </button>
                  {!loadingCourses && courses.length > 0 && (
                    <div className="courses-list">
                      <h4>Your Courses:</h4>
                      <ul>
                        {courses
                          .filter((c) => !hiddenCourses[c.id])
                          .map((course) => (
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

                <div>
                  <button className="generate-button" onClick={generateTodos} disabled={loading} style={{ width: "100%" }}>
                    {loading ? "Working..." : todos.length > 0 ? "Hide To-Do" : "Generate To-Do"}
                  </button>
                  {todosFetched && (
                    <div className={`todo-card ${isDarkMode ? "dark-mode" : ""}`}>
                      <h4 className="todo-header">Top 5 To-Do Items</h4>
                      <div className="todo-table">
                        {loading && <p>Generating...</p>}
                        {!loading && todos.length === 0 && <p>No upcoming To-Do items found.</p>}
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
        <small>Copyright 2026 TruDesign LLC | v{VERSION}</small>
      </div>
    </div>
  );
}
