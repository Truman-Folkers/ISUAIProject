import "./sidebar.css";
import { useState } from "react";
import Chatbot from "./chatbot.jsx";
import Tasklist from "./tasklist.jsx";

export default function Sidebar(){

    const [val, setVal] = useState("Ask Cy");

    const [isCollapsed, setIsCollapsed] = useState(true);

    const onEnter = () => {
        setIsCollapsed(false);
    }

    const onLeave = () => {
        setIsCollapsed(true);
    }

    const click = () => {
        // python
    }

    const change = event => {
        // do python
        setVal(event.target.value);
    }

    return(
        <div 
            className="sidebar-container"
        >

            <div className="sidebar-content-wrapper">

                <div className="sidebar-header">
                    {/* Simplified header logic */}
                    <h2>{'CyAI'}</h2>
                </div>

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

        <Chatbot />
      {/* Footer */}
      <div className="sidebar-footer">
        <small>© 2025 TruDesign LLC</small>
      </div>
    </div>
    </div>
        
    )
}
