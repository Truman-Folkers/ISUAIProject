import "./sidebar.css";
import { useState, useEffect } from "react";
import Chatbot from "./chatbot.jsx";
import { askDevStral } from "../services/openrouter.js";
import { getCanvasSyncMetadata } from "./canvasKnowledge.js";

const VERSION = "2.1.0";

export default function Sidebar({ isCollapsed, isDarkMode, setIsDarkMode }) {
  const [activeTab, setActiveTab] = useState("home");

  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
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
      return;
    }

    setLoading(true);
    try {
      const resp = await sendTabMessage("SCRAPE_PAGE");
      setTodos(resp?.success ? resp.data : []);
    } catch (err) {
      console.error("generateTodos error:", err);
      setTodos([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardCourses = async () => {
    if (dashboardCourses.length > 0) {
      setDashboardCourses([]);
      return;
    }

    setLoadingCourses(true);
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
      setDashboardCourses([]);
    } finally {
      setLoadingCourses(false);
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
            <div className="header-spacer" aria-hidden="true" />
            <h2>{isCollapsed ? "" : "CyAI"}</h2>
            {!isCollapsed && (
              <div className="header-actions">
                <button className="dark-mode-toggle" onClick={() => setIsDarkMode(!isDarkMode)} title="Toggle dark mode">
                  {isDarkMode ? "☀️" : "🌙"}
                </button>
                <button className="settings-toggle" onClick={() => setActiveTab(activeTab === "home" ? "settings" : "home")} title="Settings">
                  S
                </button>
              </div>
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
            <div className="home-page-view">
              <div className="cyai-widget-container">
                <div className="cyai-actions-row">
                  <button className="generate-button" onClick={syncCanvasData} disabled={syncingCanvas}>
                    {syncingCanvas ? "Syncing..." : "Sync Canvas Data"}
                  </button>
                  <button className="generate-button" onClick={summarizeSyllabus} disabled={summarizing}>
                    {summarizing ? "Summarizing..." : "Summarize Syllabus"}
                  </button>
                </div>

                {syllabusContent && (
                  <div className="cyai-action-results">
                    <div className="cyai-result-card">
                      <h4>Syllabus Summary</h4>
                      <textarea value={syllabusContent} readOnly className={`syllabus-output ${isDarkMode ? "dark" : ""}`} />
                    </div>
                  </div>
                )}

                <Chatbot />
              </div>
            </div>
          )}

          {activeTab === "home" && !isCoursePage && (
            <div className="home-page-view">
              <div className="cyai-widget-container">
                <div className="cyai-actions-row">
                  <button className="generate-button" onClick={syncCanvasData} disabled={syncingCanvas}>
                    {syncingCanvas ? "Syncing..." : "Sync Canvas Data"}
                  </button>
                  <button className="generate-button" onClick={loadDashboardCourses} disabled={loadingCourses}>
                    {loadingCourses ? "Loading..." : dashboardCourses.length > 0 ? "Hide Dashboard Courses" : "Load Dashboard Courses"}
                  </button>
                  <button className="generate-button" onClick={generateTodos} disabled={loading}>
                    {loading ? "Loading..." : todos.length > 0 ? "Hide To-Do" : "Load To-Do"}
                  </button>
                </div>

                {(dashboardCourses.length > 0 || todos.length > 0) && (
                  <div className="cyai-action-results">
                    {dashboardCourses.length > 0 && (
                      <div className="cyai-result-card">
                        <h4>Dashboard Courses</h4>
                        <ul className="cyai-course-list">
                          {dashboardCourses
                            .filter((course) => !hiddenCourses[course.id])
                            .map((course) => (
                              <li key={course.id}>
                                <a href={course.url} target="_blank" rel="noreferrer" className="todo-link">
                                  {course.name}
                                </a>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}

                    {todos.length > 0 && (
                      <div className={`todo-card ${isDarkMode ? "dark-mode" : ""}`}>
                        <h4 className="todo-header">Top 5 To-Do Items</h4>
                        <div className="todo-table">
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
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Chatbot />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <small>Copyright 2026 TruDesign LLC | v{VERSION}</small>
      </div>
    </div>
  );
}
