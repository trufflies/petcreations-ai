# Deploying the Pet Creations AI backend

The generator has to run on a public URL so your Shopify store can reach it
(it can't call your Mac). Recommended host: **Render** (simple, cheap).

## Steps (Render)

1. **Put this `backend/` folder on GitHub** (Claude can set the repo up for you).
2. Go to **render.com** → **New → Blueprint** → connect the repo.
   Render reads `render.yaml` automatically.
3. **Add your two API keys** as environment variables when prompted:
   - `GEMINI_API_KEY` — from your api.env.md
   - `OPENAI_API_KEY` — from your api.env.md
4. Click **Deploy**. In ~2 minutes you'll get a URL like
   `https://petcreations-ai.onrender.com`.
5. Test it: open `https://<your-url>/app/` — the studio should load and generate.

## Notes

- **Free plan** cold-starts (~30–60s on the first request after idle). For a live
  store use the **Starter plan (~$7/mo)** so previews are always instant.
- **Generated images are ephemeral** on Render (they reset on each redeploy). Fine
  for testing; before real launch we'll move storage to Cloudflare R2 / S3 so preview
  and order images persist. (Tracked as a Phase-1 hardening TODO.)
- Keys are read from environment variables in the cloud; the local `.env` / `api.env.md`
  file is only a fallback for running on your Mac.
