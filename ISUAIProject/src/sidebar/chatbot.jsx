import { useState, useRef, useEffect } from "react";
import "./chatbot.css";
import { askDevStral } from "../services/openrouter.js";
import { buildMinimalCanvasPromptContext } from "./canvasContext.js";
import { isLikelyCanvasQuestion } from "./canvasKnowledge.js";
import cyclonesLogo from "../assets/iowa_state_cyclones_logo_secondary_20088357.png";

function buildCanvasPrompt(question, canvasContext) {
  return [
    "You are CyAI, an academic assistant.",
    "Use the Canvas context below as the source of truth for course-specific facts.",
    "Answer briefly and directly.",
    "If the context does not contain the answer, say it is not found in synced Canvas data and suggest refreshing sync.",
    "",
    "CANVAS CONTEXT",
    canvasContext.contextText,
    "",
    "USER QUESTION",
    question,
  ].join("\n");
}

export default function Chatbot() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello! I'm CyAI. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

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
      const canvasContext = await buildMinimalCanvasPromptContext(question);

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

      const finalPrompt = canvasContext.hasData ? buildCanvasPrompt(question, canvasContext) : question;
      const answer = await askDevStral(finalPrompt);
      const aiMessage = { role: "assistant", content: answer };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = {
        role: "assistant",
        content: error.message || "I couldn't get a response right now. Please try again in a moment.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chatbot">
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
    </div>
  );
}
