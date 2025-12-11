import "./sidebar.css";
import { useState } from "react";
import Chatbot from "./chatbot.jsx";
import Tasklist from "./tasklist.jsx";


export default function Sidebar(){
    const [val, setVal] = useState("Ask Cy");
    const click = () =>{
        //python
    }
    const change = event => {
        //do python
        setVal(event.target.value);
    }
        

    return(
        // 2. Add the mouse event listeners here
        <div 
            className={`sidebar-container ${isCollapsed ? 'collapsed' : ''}`}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
        >
            {/* 3. Button is REMOVED. We don't need it anymore. */}

            <div className="sidebar-content-wrapper">
                <div className="sidebar-header">
                    {/* Simplified header logic */}
                    <h2>{isCollapsed ? '' : 'CyAI'}</h2>
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

        <div className = "input-box">
            <input className = "text-input" onChange = {change} value = {val}></input>
            <button className = "input-button" onClick = {click}>Go</button>
        </div>
      {/* Footer */}
      <div className="sidebar-footer">
        <small>© 2025 TruDesign LLC</small>
      </div>
    </div>
        
    )
}