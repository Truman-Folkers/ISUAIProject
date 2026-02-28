/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

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

		const geminiRes = await fetch(
		`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		}
		);

		const data = await geminiRes.json();
		return corsResponse(data, geminiRes.status);

		} catch (err) {
		return corsResponse({ error: 'Proxy error', detail: err.message }, 500);
		}
	}
	};

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
