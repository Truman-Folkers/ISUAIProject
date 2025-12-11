import { useState } from "react";
import "./chatbot.css";
import { askDevStral } from "../services/openrouter.js";

export default function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

const sendMessage = async () => {
    if (!input) return;

    // Add user message
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);

    setInput("");

    // Send to AI
    const reply = await askDevStral(input);

    // Add AI response
    setMessages([...newMessages, { role: "assistant", content: reply }]);
  };

  return (
    <div className="chatbot">
      <div className="messages">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={m.role === "user" ? "user" : "assistant"}
          >
            {m.content}
          </div>
        ))}
      </div>

      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type your message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );


}
