import "./sidebar.css";

export default function Sidebar(){
    return(
        <div className="sidebar-container">
      {/* Header */}
      <div className="sidebar-header">
        <h2>Canvas AI</h2>
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

      {/* Footer */}
      <div className="sidebar-footer">
        <small>© 2025 Your Extension</small>
      </div>
    </div>
        
    )
}