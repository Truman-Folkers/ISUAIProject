import { useState, useRef, useEffect } from "react";
import "./chatbot.css";
import { askDevStral } from "../services/openrouter.js";
import { buildCanvasPromptContext, isLikelyCanvasQuestion } from "./canvasKnowledge.js";
import cyclonesLogo from "../assets/iowa_state_cyclones_logo_secondary_20088357.png";
import settingsIcon from "../assets/black-settings-button.png";

export default function Chatbot({
  quickActions = [],
  syncAction = null,
  isDarkMode = false,
  onToggleDarkMode = () => {},
  onOpenSettings = () => {},
}) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi, I'm your canvas virtual agent. Let me know how I can help you today." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  async function handleQuickAction(action) {
    if (!action || action.disabled || typeof action.onClick !== "function") return;

    try {
      const result = await action.onClick();
      const assistantText = typeof action.toAgentMessage === "function"
        ? action.toAgentMessage(result)
        : action.agentMessage;

      if (assistantText) {
        setMessages((prev) => [...prev, { role: "assistant", content: assistantText }]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `I hit an issue running that action: ${error.message || String(error)}` },
      ]);
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleAskAI() {
    if (!input.trim() || loading) return;

    const question = input;
    const userMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const canvasQuery = isLikelyCanvasQuestion(question);
      const canvasContext = await buildCanvasPromptContext(question);

      if (canvasQuery && !canvasContext.hasData) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "I do not have synced Canvas data yet. Click 'Sync Canvas Data' in CyAI first, then ask again for course-specific dates and policies.",
          },
        ]);
        return;
      }

      let finalPrompt = question;
      if (canvasContext.hasData) {
        finalPrompt = `You are CyAI, an academic assistant. Use the Canvas context below as the source of truth for course-specific facts. Do not fabricate dates or policies. If the context is missing the answer, say it is not found in synced data and recommend refreshing sync.\n\nCANVAS CONTEXT\n${canvasContext.contextText}\n\nUSER QUESTION\n${question}`;
      }

      const answer = await askDevStral(finalPrompt);
      const aiMessage = { role: "assistant", content: answer };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = {
        role: "assistant",
        content: `Error: ${error.message || "Failed to get response"}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chatbot chatbot--cyai">
      <div className="cyai-header">
        <div className="cyai-title-wrap">
          <img src={cyclonesLogo} alt="CyAI" className="cyai-title-avatar" />
          <span className="cyai-title">CyAI</span>
        </div>
        <div className="cyai-header-actions">
          <button
            type="button"
            className="cyai-header-button"
            onClick={onToggleDarkMode}
            title="Toggle dark mode"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? "☀️" : "🌙"}
          </button>
          <button
            type="button"
            className="cyai-header-button cyai-settings-button"
            onClick={onOpenSettings}
            title="Settings"
            aria-label="Open settings"
          >
            <img src={settingsIcon} alt="Settings" />
          </button>
        </div>
      </div>

      <div className="messages-container">
        <div className="messages">
          {messages.map((m, idx) => (
            <div key={idx} className={`message-row ${m.role}`}>
              {m.role === "assistant" && <img src={cyclonesLogo} alt="CyAI" className="avatar" />}
              <div className={`message ${m.role}`}>
                <div className="message-content">{m.content}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-row assistant">
              <img src={cyclonesLogo} alt="CyAI" className="avatar" />
              <div className="message assistant">
                <div className="message-content typing">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="chat-composer">
        {quickActions.length > 0 && (
          <div className="suggested-actions" role="group" aria-label="Suggested actions">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                type="button"
                className="suggestion-chip"
                onClick={() => handleQuickAction(action)}
                disabled={action.disabled}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        <div className="input-area">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAskAI()}
            placeholder="Ask me anything..."
            disabled={loading}
          />
          <button onClick={handleAskAI} disabled={loading || !input.trim()} className="send-button">
            {loading ? "..." : "->"}
          </button>
        </div>

        {syncAction && (
          <div className="sync-row">
            <button
              type="button"
              className="sync-mini-button"
              onClick={syncAction.onClick}
              disabled={syncAction.disabled}
            >
              {syncAction.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
