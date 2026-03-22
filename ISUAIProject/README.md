# CyAI Extension

## Chat setup

The popup chat talks to the Cloudflare worker in `gemini-proxy/`.

1. Copy `.env.example` to `.env`
2. Set `VITE_EXTENSION_SECRET` to a random shared secret
3. In `gemini-proxy/`, set the same value as the worker secret `EXTENSION_SECRET`
4. Set your Azure OpenAI worker secrets:
   `AZURE_OPENAI_ENDPOINT`
   `AZURE_OPENAI_DEPLOYMENT`
   `AZURE_OPENAI_API_VERSION`
   `AZURE_OPENAI_API_KEY`
5. Rebuild the extension and redeploy the worker

Example commands:

```powershell
cd C:\Users\truma\Downloads\Coding\isuAI-innovation\ISUAIProject\ISUAIProject\gemini-proxy
npx wrangler secret put EXTENSION_SECRET
npx wrangler secret put AZURE_OPENAI_API_KEY
npx wrangler secret put AZURE_OPENAI_ENDPOINT
npx wrangler secret put AZURE_OPENAI_DEPLOYMENT
npx wrangler secret put AZURE_OPENAI_API_VERSION
npx wrangler deploy
```

If you already stored the Azure key under `GEMINI_API_KEY`, the worker will still use it as a fallback, but switching to `AZURE_OPENAI_API_KEY` is the cleaner permanent setup.

Then rebuild the extension:

```powershell
cd C:\Users\truma\Downloads\Coding\isuAI-innovation\ISUAIProject\ISUAIProject
cmd /c npm run build
```

## Canvas sync

Canvas sync only works while you are on a Canvas page covered by the extension manifest. After a successful sync, chat uses the synced course data and upcoming planner items when answering course-specific questions.
