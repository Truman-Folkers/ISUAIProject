import "./sidebar.css";
import { useState } from "react";

// 1. Accept the new onEnter and onLeave props
export default function Sidebar({ isCollapsed, onEnter, onLeave }){
    const [val, setVal] = useState("Ask Cy");

    const click = () =>{
        console.log("Submit: " + val);
    }
    const change = event => {
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

                <div className="sidebar-content">
                    <p>Welcome to your AI-powered sidebar!</p>
                    <div className="card">
                        <h3>Tool 1</h3>
                        <p>Quick description here.</p>
                    </div>
                </div>

                <div className="input-box">
                    <input className="text-input" onChange={change} value={val}></input>
                    <button className="input-button" onClick={click}>Go</button>
                </div>

                <div className="sidebar-footer">
                    <small>© 2025 TruDesign LLC</small>
                </div>
            </div>
        </div>
    )
}