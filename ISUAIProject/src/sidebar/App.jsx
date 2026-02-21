import { useState, useEffect } from "react";
import Sidebar from "./sidebar.jsx";
import "./sidebar.css";

export default function App() {
  // Default to TRUE so it starts collapsed
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Listen for expand/collapse messages from the content script
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === "SIDEBAR_EXPAND") {
        setIsCollapsed(false);
      } else if (event.data?.type === "SIDEBAR_COLLAPSE") {
        setIsCollapsed(true);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div className={`app-container ${isDarkMode ? 'dark-mode' : ''}`}>
      <Sidebar 
        isCollapsed={isCollapsed} 
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />
    </div>
  );
}