const PROXY_URL = import.meta.env.VITE_CHAT_PROXY_URL || "https://gemini-proxy.cyai.workers.dev";
const EXTENSION_SECRET = import.meta.env.VITE_EXTENSION_SECRET || "";
const MAX_PROMPT_CHARS = 12000;

function trimPrompt(prompt) {
  const text = String(prompt || "").trim();
  if (text.length <= MAX_PROMPT_CHARS) return text;
  return `${text.slice(0, MAX_PROMPT_CHARS)}\n\n[Prompt truncated to reduce request size]`;
}

function extractErrorDetail(payload, status) {
  if (!payload) return `HTTP error ${status}`;
  return (
    payload?.error?.message ||
    payload?.error ||
    payload?.detail ||
    payload?.message ||
    `HTTP error ${status}`
  );
}

function buildFriendlyError(status, detail) {
  if (status === 401) {
    return new Error(
      "Chat proxy authentication failed. Set the same extension secret in the worker and in Vite, then rebuild the extension."
    );
  }

  if (status === 429) {
    return new Error(
      `CyAI is rate limited right now. This usually means the deployed Azure OpenAI deployment or API key is hitting quota or rate limits. ${detail}`.trim()
    );
  }

  if (status >= 500) {
    return new Error("CyAI's chat service is having trouble right now. Please try again shortly.");
  }

  return new Error(detail || `HTTP error ${status}`);
}

export async function askDevStral(prompt) {
  if (!EXTENSION_SECRET) {
    throw new Error(
      "Missing VITE_EXTENSION_SECRET. Add it to your extension .env, rebuild, and make sure it matches the worker's EXTENSION_SECRET."
    );
  }

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: trimPrompt(prompt) }],
      },
    ],
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Extension-Secret": EXTENSION_SECRET,
      },
      body: JSON.stringify(payload),
    });

    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfterSeconds = Number.parseInt(retryAfterHeader || "", 10);
    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (response.ok) {
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response returned.";
    }

    if (response.status === 429 && attempt === 0) {
      const waitMs = Number.isFinite(retryAfterSeconds)
        ? Math.max(retryAfterSeconds * 1000, 1200)
        : 1500;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    const detail = extractErrorDetail(data, response.status);
    throw buildFriendlyError(response.status, detail);
  }

  throw new Error("Chat request failed after retry.");
}
