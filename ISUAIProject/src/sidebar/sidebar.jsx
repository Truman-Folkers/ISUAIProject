import "./sidebar.css";
import { useState } from "react";

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
        <div className="sidebar-container">
      {/* Header */}
      <div className="sidebar-header">
        <h2>CyAI</h2>
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