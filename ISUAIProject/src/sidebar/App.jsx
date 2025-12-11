import { useState } from "react";
import Sidebar from "./sidebar.jsx";
import "./sidebar.css";

export default function App() {
  // 1. Default to TRUE so it starts collapsed
  const [isCollapsed, setIsCollapsed] = useState(true);

  // 2. Define specific handlers for hover
  const handleMouseEnter = () => {
    setIsCollapsed(false); // Expand when mouse enters
  };

  const handleMouseLeave = () => {
    setIsCollapsed(true);  // Collapse when mouse leaves
  };

  return (
    <div className="app-container">
      <Sidebar 
        isCollapsed={isCollapsed} 
        onEnter={handleMouseEnter} 
        onLeave={handleMouseLeave} 
      />
    </div>
  );
}