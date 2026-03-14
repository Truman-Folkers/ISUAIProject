console.log("=== GEMINI DEBUG ===");

const PROXY_URL = "https://gemini-proxy.cyai.workers.dev";
const EXTENSION_SECRET = "e61dac77-116d-49f3-959f-e79721d1626c";
const MAX_PROMPT_CHARS = 12000;

function trimPrompt(prompt) {
  const text = String(prompt || "").trim();
  if (text.length <= MAX_PROMPT_CHARS) return text;
  return `${text.slice(0, MAX_PROMPT_CHARS)}\n\n[Prompt truncated to reduce request size]`;
}

async function parseProxyResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

function buildFriendlyError(status, payload) {
  const detail =
    payload?.error?.message ||
    payload?.error ||
    payload?.detail ||
    payload?.rawText ||
    "";

  if (status === 429) {
    return new Error(
      "CyAI is temporarily rate limited right now. Please wait a minute and try again. I also reduced how much Canvas context gets sent to help avoid this."
    );
  }

  if (status === 401) {
    return new Error("CyAI could not authenticate with the chat proxy.");
  }

  if (status >= 500) {
    return new Error("CyAI's chat service is having trouble right now. Please try again shortly.");
  }

  return new Error(detail ? `Chat request failed: ${detail}` : `HTTP error ${status}`);
}

export async function askDevStral(prompt) {
  const response = await fetch(PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Extension-Secret": EXTENSION_SECRET,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: trimPrompt(prompt) }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 768,
        temperature: 0.2,
      },
    }),
  });

  const data = await parseProxyResponse(response);
  if (!response.ok) {
    throw buildFriendlyError(response.status, data);
  }

  console.log("Gemini response:", data);

  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response returned.";
}
