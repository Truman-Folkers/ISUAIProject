// src/services/openrouter.js
import { OpenRouter } from "@openrouter/sdk";

const MODEL = "mistralai/devstral-2512:free";

const client = new OpenRouter({
  apiKey: import.meta.env.VITE_OPENROUTER_API_KEY
});

export async function askDevStral(prompt) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`
    },
    body: JSON.stringify({
      model: "mistralai/devstral-2512:free",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt }
      ]
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
