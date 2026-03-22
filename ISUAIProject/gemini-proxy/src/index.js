export default {
	async fetch(request, env, ctx) {
		// CORS preflight
		if (request.method === 'OPTIONS') {
		return corsResponse(null, 204);
		}

		if (request.method !== 'POST') {
		return corsResponse({ error: 'Method not allowed' }, 405);
		}

		// Optional: simple auth so randoms can't hit your proxy
		const authHeader = request.headers.get('X-Extension-Secret');
		if (authHeader !== env.EXTENSION_SECRET) {
		return corsResponse({ error: 'Unauthorized' }, 401);
		}

		try {
		const body = await request.json();
		const apiKey = env.AZURE_OPENAI_API_KEY;
		const endpoint = String(env.AZURE_OPENAI_ENDPOINT || "").replace(/\/+$/, "");
		const deployment = env.AZURE_OPENAI_DEPLOYMENT || env.AZURE_OPENAI_MODEL || "gpt-4o-mini";
		const apiVersion = env.AZURE_OPENAI_API_VERSION || "2024-10-21";

		if (!apiKey) {
		return corsResponse({ error: "Missing Azure OpenAI API key" }, 500);
		}

		if (!endpoint) {
		return corsResponse({ error: "Missing Azure OpenAI endpoint" }, 500);
		}

		const azureRes = await fetch(
		`${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
		{
			method: 'POST',
			headers: {
			'Content-Type': 'application/json',
			'api-key': apiKey,
			},
			body: JSON.stringify(buildAzureChatRequest(body)),
		}
		);

		const data = await azureRes.json();
		if (!azureRes.ok) {
		return corsResponse(data, azureRes.status);
		}

		return corsResponse(normalizeAzureResponse(data), 200);

		} catch (err) {
		return corsResponse({ error: 'Proxy error', detail: err.message }, 500);
		}
	}
	};

function buildAzureChatRequest(body) {
  const messages = normalizeMessages(body);
  return {
    messages,
    temperature: typeof body?.temperature === "number" ? body.temperature : 0.2,
    max_tokens: typeof body?.max_tokens === "number" ? body.max_tokens : 900,
  };
}

function normalizeMessages(body) {
  if (Array.isArray(body?.messages) && body.messages.length > 0) {
    return body.messages.map((message) => ({
      role: normalizeRole(message?.role),
      content: normalizeContent(message?.content),
    }));
  }

  if (Array.isArray(body?.contents) && body.contents.length > 0) {
    return body.contents
      .map((entry) => {
        const content = Array.isArray(entry?.parts)
          ? entry.parts
              .map((part) => part?.text || "")
              .filter(Boolean)
              .join("\n")
              .trim()
          : "";
        if (!content) return null;
        return {
          role: normalizeRole(entry?.role),
          content,
        };
      })
      .filter(Boolean);
  }

  return [{ role: "user", content: "" }];
}

function normalizeRole(role) {
  if (role === "model") return "assistant";
  if (role === "assistant" || role === "system") return role;
  return "user";
}

function normalizeContent(content) {
  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text || item?.content || "")
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return String(content || "");
}

function normalizeAzureResponse(data) {
  const text = data?.choices?.[0]?.message?.content || "No response returned.";
  return {
    candidates: [
      {
        content: {
          parts: [{ text }],
        },
      },
    ],
    provider: "azure-openai",
    raw: data,
  };
}

function corsResponse(body, status = 200) {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Extension-Secret',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}
