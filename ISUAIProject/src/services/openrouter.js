// // src/services/openrouter.js - UPDATED
// // import { OpenRouter } from "@openrouter/sdk";

// console.log("=== OPENROUTER DEBUG ===");
// console.log("SDK loaded:", !!OpenRouter);
// console.log("Key loaded:", !!import.meta.env.VITE_GEMINI_API_KEY);

// let client;

// export async function askDevStral(prompt) {
//   console.log("askDevStral called with:", prompt.substring(0, 50) + "...");
  
//   if (!client) {
//     const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
//     if (!apiKey) {
//       throw new Error("API key not found in environment variables");
//     }
    
//     console.log("Initializing OpenRouter client...");
    
//     // Initialize the client with the correct configuration
//     client = new OpenRouter({
//       apiKey: apiKey,
//       // Add all required headers
//       defaultHeaders: {
//         "HTTP-Referer": window.location.origin || "http://localhost:5173",
//         "X-Title": "DevStral Extension",
//         "Content-Type": "application/json"
//       }
//     });
    
//     console.log("Client initialized:", !!client);
//     console.log("Client structure:", Object.keys(client));
//   }
  
//   try {
//     console.log("Making API call...");
    
//     // Debug: Check client structure

//     console.log("Client completions:", client.chat?.completions);
    
//     // Alternative: Use client directly if structure is different
//     const response = await client.chat.send({
//       model: "mistralai/devstral-2512:free",
//       messages: [
//         { role: "system", content: "You are a helpful assistant." },
//         { role: "user", content: prompt }
//       ]
//     });
    
//     console.log("Response received:", response);
    
//     // Extract content based on possible response formats
//     if (response?.choices?.[0]?.message?.content) {
//       return response.choices[0].message.content;
//     } else if (response?.data?.choices?.[0]?.message?.content) {
//       return response.data.choices[0].message.content;
//     } else if (response?.content) {
//       return response.content;
//     } else {
//       console.error("Unexpected response format:", response);
//       return "Received response in unexpected format.";
//     }
    
//   } catch (error) {
//     console.error("FULL ERROR DETAILS:", {
//       name: error.name,
//       message: error.message,
//       stack: error.stack,
//       response: error.response?.data
//     });
    
//     // Provide user-friendly error
//     if (error.message?.includes("401")) {
//       throw new Error("Invalid API key. Please check your OpenRouter API key.");
//     }
//     if (error.message?.includes("rate limit")) {
//       throw new Error("Rate limit exceeded. Please try again later.");
//     }
    
//     throw new Error(`API Error: ${error.message}`);
//   }
// }

// src/services/openrouter.js
const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

export async function askDevStral(prompt) {
  if (!API_KEY) {
    throw new Error("OpenRouter API key not found. Set VITE_OPENROUTER_API_KEY in your .env file.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://canvas.iastate.edu",
      "X-Title": "CyAI Extension",
    },
    body: JSON.stringify({
      model: "mistralai/devstral-2512:free",
      messages: [
        {
          role: "system",
          content: "You are CyAI, a helpful academic assistant for Iowa State University students using Canvas LMS.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? "No response returned.";
}