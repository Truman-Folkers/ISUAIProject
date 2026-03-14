import "./sidebar.css";
import { useState, useEffect } from "react";
import Chatbot from "./chatbot.jsx";
import { askDevStral } from "../services/openrouter.js";
import { getCanvasSyncMetadata } from "./canvasKnowledge.js";
import bubbleChatIcon from "../assets/chat.png";

const VERSION = "2.1.0";

export default function Sidebar({ isCollapsed, isDarkMode, setIsDarkMode }) {
  const [activeTab, setActiveTab] = useState("home");

  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingComingUp, setLoadingComingUp] = useState(false);
  const [loadingSemesterFilter, setLoadingSemesterFilter] = useState(false);
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
      if (match && !url.includes("/settings")) {
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
    setLoading(true);
    try {
      const resp = await sendTabMessage("SCRAPE_PAGE");
      const items = resp?.success ? resp.data : [];
      setTodos(items);
      return { action: "load_todos", items };
    } catch (err) {
      console.error("generateTodos error:", err);
      setTodos([]);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loadComingUpFeed = async () => {
    setLoadingComingUp(true);
    try {
      const resp = await sendTabMessage("SCRAPE_COMING_UP");
      const items = resp?.success ? (resp.data || []) : [];
      return { action: "coming_up", items };
    } catch (err) {
      console.error("loadComingUpFeed error:", err);
      throw err;
    } finally {
      setLoadingComingUp(false);
    }
  };

  const loadDashboardCourses = async () => {
    if (dashboardCourses.length > 0) {
      setDashboardCourses([]);
      return { action: "hide_courses" };
    }

    setLoadingCourses(true);
    try {
      const resp = await sendTabMessage("GET_DASHBOARD_COURSES");
      if (resp?.success) {
        const courses = resp.data || [];
        setDashboardCourses(courses);
        chrome.storage.sync.get("hiddenCourses", (data) => {
          if (data.hiddenCourses) setHiddenCourses(data.hiddenCourses);
        });
        return { action: "load_courses", courses };
      }
      return { action: "load_courses", courses: [] };
    } catch (err) {
      console.error("loadDashboardCourses error:", err);
      setDashboardCourses([]);
      throw err;
    } finally {
      setLoadingCourses(false);
    }
  };

  const runSemesterFilter = async () => {
    setLoadingSemesterFilter(true);
    try {
      const resp = await sendTabMessage("DETECT_GHOST_COURSES");
      const ghosts = resp?.success ? (resp.data || []) : [];

      if (ghosts.length === 0) {
        return { action: "semester_filter", hiddenCount: 0, newlyHiddenCount: 0, ghosts: [], alreadyFiltered: false };
      }

      const updated = { ...hiddenCourses };
      let newlyHiddenCount = 0;
      for (const ghost of ghosts) {
        if (!ghost?.id) continue;
        if (!updated[ghost.id]) newlyHiddenCount += 1;
        updated[ghost.id] = true;
      }

      const alreadyFiltered = newlyHiddenCount === 0;

      if (alreadyFiltered) {
        return {
          action: "semester_filter",
          hiddenCount: ghosts.length,
          newlyHiddenCount,
          ghosts,
          alreadyFiltered: true,
        };
      }

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

      return {
        action: "semester_filter",
        hiddenCount: ghosts.length,
        newlyHiddenCount,
        ghosts,
        alreadyFiltered: false,
      };
    } catch (err) {
      console.error("runSemesterFilter error:", err);
      throw err;
    } finally {
      setLoadingSemesterFilter(false);
    }
  };

  const semesterFilterMessage = (result) => {
    if (result?.alreadyFiltered) {
      return "Semester has been filtered.";
    }

    const newlyHiddenCount = result?.newlyHiddenCount || 0;
    const ghosts = result?.ghosts || [];
    if (newlyHiddenCount === 0) {
      return "No on-screen courses needed filtering.";
    }

    const preview = ghosts
      .filter((ghost) => ghost?.id && !hiddenCourses[ghost.id])
      .slice(0, 5)
      .map((ghost, idx) => `${idx + 1}. ${ghost.name} (${ghost.reason || "outside S2026"})`)
      .join("\n");

    if (!preview) {
      return `Semester filter hidden ${newlyHiddenCount} course(s).`;
    }

    return `Semester filter hidden ${newlyHiddenCount} on-screen course(s):\n${preview}`;
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
        <div className={`sidebar-content ${activeTab === "home" || activeTab === "settings" ? "home-layout" : ""}`}>
          {activeTab === "settings" && (
            <div className="home-page-view">
              <div className="cyai-widget-container settings-dashboard-shell">
                <div className="settings-dashboard-header">
                  <div className="settings-dashboard-title-wrap">
                    <span className="settings-dashboard-title">CyAI</span>
                    <span className="settings-dashboard-tag">Settings</span>
                  </div>
                  <div className="settings-dashboard-actions">
                    <button className="dark-mode-toggle" onClick={() => setIsDarkMode(!isDarkMode)} title="Toggle dark mode">
                      {isDarkMode ? "☀️" : "🌙"}
                    </button>
                    <button
                      className="generate-button settings-back-button settings-icon-button"
                      onClick={() => setActiveTab("home")}
                      title="Return to chat"
                      aria-label="Return to chat"
                    >
                      <img src={bubbleChatIcon} alt="" aria-hidden="true" className="settings-icon-image" />
                    </button>
                  </div>
                </div>

                <div className="settings-dashboard-body">
                  <div className="settings-panel">
                    <h4 className="settings-section-title">Canvas Sync</h4>
                    {syncPanel}
                  </div>

                  {!isCoursePage && (
                    <div className="settings-panel">
                      <h4 className="settings-section-title">Dashboard Courses</h4>
                      <p className="settings-subtitle">Choose which courses stay visible on your Canvas dashboard.</p>
                      <button className="generate-button" onClick={loadDashboardCourses} style={{ width: "100%", marginBottom: "10px" }}>
                        {loadingCourses ? "Loading Courses..." : "Load Dashboard Courses"}
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
                        <p className="settings-empty">Load your current dashboard courses to manage visibility.</p>
                      )}
                    </div>
                  )}

                  {isCoursePage && (
                    <div className="settings-panel">
                      <h4 className="settings-section-title">Course Settings</h4>
                      <p className="settings-empty">Course-specific controls are coming soon.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "home" && isCoursePage && (
            <div className="home-page-view">
              <div className="cyai-widget-container">
                {syllabusContent && (
                  <div className="cyai-action-results">
                    <div className="cyai-result-card">
                      <h4>Syllabus Summary</h4>
                      <textarea value={syllabusContent} readOnly className={`syllabus-output ${isDarkMode ? "dark" : ""}`} />
                    </div>
                  </div>
                )}

                <Chatbot
                  isDarkMode={isDarkMode}
                  onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
                  onOpenSettings={() => setActiveTab("settings")}
                  quickActions={[
                    {
                      label: loadingSemesterFilter ? "Filtering..." : "Semester Filter",
                      onClick: runSemesterFilter,
                      disabled: loadingSemesterFilter,
                      toAgentMessage: semesterFilterMessage,
                    },
                    {
                      label: loadingComingUp ? "Loading..." : "Coming Up (72h)",
                      onClick: loadComingUpFeed,
                      disabled: loadingComingUp,
                      toAgentMessage: (result) => {
                        const items = result?.items || [];
                        if (items.length === 0) {
                          return "No assignments due in the next 72 hours for this course.";
                        }

                        const preview = items
                          .map((item, idx) => {
                            const title = item.title || "Untitled task";
                            const course = item.course || "Unknown course";
                            const due = item.due_text || "No due date";
                            const remain = item.remaining_text || "soon";
                            return `${idx + 1}. ${title}\n   ${course} | ${remain} | ${due}`;
                          })
                          .join("\n");
                        return `Coming up in next 72 hours:\n${preview}`;
                      },
                    },
                    {
                      label: summarizing ? "Summarizing..." : "Summarize Syllabus",
                      onClick: summarizeSyllabus,
                      disabled: summarizing,
                    },
                  ]}
                  syncAction={{
                    label: syncingCanvas ? "Syncing..." : "Sync Canvas Data",
                    onClick: syncCanvasData,
                    disabled: syncingCanvas,
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === "home" && !isCoursePage && (
            <div className="home-page-view">
              <div className="cyai-widget-container">
                <Chatbot
                  isDarkMode={isDarkMode}
                  onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
                  onOpenSettings={() => setActiveTab("settings")}
                  quickActions={[
                    {
                      label: loadingSemesterFilter ? "Filtering..." : "Semester Filter",
                      onClick: runSemesterFilter,
                      disabled: loadingSemesterFilter,
                      toAgentMessage: semesterFilterMessage,
                    },
                    {
                      label: loadingComingUp ? "Loading..." : "Coming Up (72h)",
                      onClick: loadComingUpFeed,
                      disabled: loadingComingUp,
                      toAgentMessage: (result) => {
                        const items = result?.items || [];
                        if (items.length === 0) {
                          return "No assignments due in the next 72 hours.";
                        }

                        const preview = items
                          .map((item, idx) => {
                            const title = item.title || "Untitled task";
                            const course = item.course || "Unknown course";
                            const due = item.due_text || "No due date";
                            const remain = item.remaining_text || "soon";
                            return `${idx + 1}. ${title}\n   ${course} | ${remain} | ${due}`;
                          })
                          .join("\n");
                        return `Coming up in next 72 hours:\n${preview}`;
                      },
                    },
                    {
                      label: loading ? "Loading..." : "Load To-Do",
                      onClick: generateTodos,
                      disabled: loading,
                      toAgentMessage: (result) => {
                        if (!result) return "I loaded your to-do list.";
                        const items = (result.items || []).slice(0, 5);
                        if (items.length === 0) return "I could not find any to-do items right now.";

                        const truncate = (value, max = 56) => {
                          if (!value) return "";
                          return value.length > max ? `${value.slice(0, max - 1)}...` : value;
                        };

                        const preview = items
                          .map((item, idx) => {
                            const title = truncate(item.title || "Untitled task", 52);
                            const due = item.due_text || "No due date";
                            const course = item.course || "Unknown course";
                            return `${idx + 1}. ${title}\n   ${course} | ${due}`;
                          })
                          .join("\n");
                        return `Top to-do items:\n${preview}`;
                      },
                    },
                  ]}
                  syncAction={{
                    label: syncingCanvas ? "Syncing..." : "Sync Canvas Data",
                    onClick: syncCanvasData,
                    disabled: syncingCanvas,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {activeTab === "settings" && (
        <div className="sidebar-footer">
          <small>Copyright 2026 TruDesign LLC | v{VERSION}</small>
        </div>
      )}
    </div>
  );
}
