import { useState } from "react";
import "./chatbot.css";

export default function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  async function sendMessage() {
    if (!input.trim()) return;

    // Add user message
    setMessages((m) => [...m, { role: "user", text: input }]);

    // Send message to your backend
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input })
    });

    const data = await res.json();

    // Add AI response
    setMessages((m) => [...m, { role: "assistant", text: data.reply }]);

    setInput("Ask Cy");
  }

  return (
    <div className="chatbot">
      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={m.role}>{m.text}</div>
        ))}
      </div>

      <div className="input-area">
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
