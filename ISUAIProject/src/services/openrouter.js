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

// src/services/gemini.js





console.log("=== GEMINI DEBUG ===");
// console.log("Key loaded:", !!import.meta.env.VITE_GEMINI_API_KEY);

// let apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// if (!apiKey) {
//   throw new Error("Gemini API key not found in environment variables");
// }
const PROXY_URL = 'https://gemini-proxy.cyai.workers.dev';
const EXTENSION_SECRET = 'e61dac77-116d-49f3-959f-e79721d1626c';

export async function askDevStral(prompt) {
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ]
  };

  // Retry once on 429 using Retry-After when available.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Secret': EXTENSION_SECRET,
      },
      body: JSON.stringify(payload),
    });

    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterSeconds = Number.parseInt(retryAfterHeader || '', 10);
    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (response.ok) {
      console.log('Gemini response:', data);
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response returned.';
    }

    if (response.status === 429 && attempt === 0) {
      const waitMs = Number.isFinite(retryAfterSeconds)
        ? Math.max(retryAfterSeconds * 1000, 1200)
        : 1500;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    const detail = data?.error?.message || data?.detail || `HTTP error ${response.status}`;
    if (response.status === 429) {
      throw new Error('Rate limit reached (429). Please wait a bit and try again. ' + detail);
    }
    throw new Error(detail);
  }

  throw new Error('Request failed after retry.');
}
  //     `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
  //     {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({
  //         contents: [
  //           {
  //             role: "user",
  //             parts: [{ text: prompt }]
  //           }
  //         ]
  //       }),
  //     }
  //   );

  //   if (!response.ok) {
  //     throw new Error(`HTTP error ${response.status}`);
  //   }

  //   const data = await response.json();
  //   console.log("Gemini response:", data);

  //   return data?.candidates?.[0]?.content?.parts?.[0]?.text
  //     || "No response returned.";

  // } catch (error) {
  //   console.error("FULL ERROR DETAILS:", error);
  //   throw new Error(`Gemini API Error: ${error.message}`);
  // }const response = await fetch(PROXY_URL, {
