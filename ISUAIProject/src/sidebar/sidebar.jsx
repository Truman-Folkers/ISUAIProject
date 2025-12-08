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

        <div className="separator">
          <div className="left-side">
            <div className="table">
              <thead>
                <tr>
                  <th>Upcoming Assignments</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Assignment 1</th>
                </tr>
              </tbody>
              <tbody>
                <tr>
                  <th>Assignment 2</th>
                </tr>
              </tbody>
            </div>
          </div>
          <div className="right-side">
            <div className="card">  
              <h3>Tool 1</h3>
              <p>Temporary description</p>
            </div>
            <div className="card">
              <h3>Tool 2</h3>
              <p>Another description</p>
            </div>
          </div>
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