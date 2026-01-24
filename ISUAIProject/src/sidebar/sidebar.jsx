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

    function renderTodos(todos) {
    const tbody = document.querySelector("tbody");
    tbody.innerHTML = "";

    todos.forEach(todo => {
        const row = document.createElement("tr");
        row.innerHTML = `
        <td>${todo.task}</td>
        <td>${todo.due_date}</td>
        <td>${todo.priority}</td>
        `;
        tbody.appendChild(row);
    });
}


    return(
        <div 
            className={`sidebar-container ${isCollapsed ? 'collapsed' : ''}`}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
        >

            <div className="sidebar-content-wrapper">

                <div className="sidebar-header">
                    {/* Simplified header logic */}
                    <h2>{isCollapsed ? '' : 'CyAI'}</h2>
                </div>

                <div className="sidebar-content">
                    <p>Welcome to your AI-powered sidebar!</p>
                    <p>Use this space to display tools, suggestions, or controls.</p>

                    <div className="separator">
                    <div className="left-side">
                    {/* <div className="table">
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
                    </div> */}
                    renderTodos();
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

        <Chatbot />
      {/* Footer */}
      <div className="sidebar-footer">
        <small>© 2025 TruDesign LLC</small>
      </div>
    </div>
    </div>
        
    )
}
