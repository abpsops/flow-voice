# FLOW Voice — Bunker Availability Agent

Standalone voice/text agent. Ask it a casual question like "Hey FLOW,
can we do 220 MT VLSFO on 25th July?" — it transcribes your voice,
understands the request via AI, then answers using deterministic,
tested feasibility math (calibrated from 140 real historical BDN
supply records) — never lets the AI invent the answer.

Not connected to the live FLOW app or its database. Fully separate.

## How it works
- `index.html` — the voice/text UI, plus the real feasibility math
  (ported verbatim from the FLOW app's own tested logic)
- `api/extract-intent.js` — a small serverless backend function. Holds
  your Gemini API key securely (server-side only, never exposed to
  the browser) and does ONE job: turn your casual sentence into
  structured fields (quantity, fuel, date, barge), using an
  example-based prompt for reliable extraction. It never computes
  the actual feasibility answer.

## Setup — do this once

### 1. Get a Gemini API key (free tier, no card required)
1. Go to **aistudio.google.com**
2. Sign in with any Google account
3. Click **"Get API key"** → **Create API key**
4. Copy it — you'll paste it into Vercel in step 3 below, never into
   any file in this repo

### 2. Push this repo to GitHub
Push all these files (flat, at the repo root — `index.html`, `api/`,
`package.json`, etc.) to a new GitHub repo.

### 3. Deploy to Vercel
1. vercel.com → sign in with GitHub → **Add New → Project**
2. Select this repo, Framework Preset: **Other**
3. **Project Settings → Environment Variables**
4. Add a variable:
   - Name: `GEMINI_API_KEY`
   - Value: (paste your key from step 1)
   - Environment: Production (and Preview if you want)
5. Deploy / redeploy

That's it — the live URL Vercel gives you is the working voice agent.

## Verification status — read this before relying on it
The backend and frontend code both pass syntax checks, and the core
feasibility math was functionally tested with real scenarios before
being included here. **The live end-to-end path (voice → transcription
→ this backend → Gemini → structured answer → speech) has NOT been
tested against a real deployment** — this environment has no
microphone, no live API key, and no network access to Google's API to
verify it end-to-end. Deploy it and try a real question; if anything
breaks, check the browser console (F12) for frontend errors or
Vercel's function logs (Project → Deployments → the function) for
backend errors, and share the exact error for a precise fix rather
than a guess.

## Notes
- Voice recognition (speech-to-text) uses the browser's built-in
  engine — works best in Chrome/Edge. A text-input fallback is always
  available if voice isn't supported.
- Voice output (text-to-speech) also uses the browser's built-in
  engine — no extra setup needed.
- Calibrated rates (FNSA 10: 224 MT/h VLSFO, 95 MT/h LSMGO, 1.8h hose;
  FNSA 11: 282 MT/h VLSFO, 113 MT/h LSMGO, 1.95h hose) are derived from
  126 clean records out of 140 total (11 excluded — source data had
  a date-typo where "Completed" preceded "Commenced").
- "Existing Committed Ops" in the UI is manually entered per session —
  this tool has no live database connection. If/when this gets
  integrated into the real FLOW app later, that section would instead
  pull from the live nomination board automatically.
- Model used: `gemini-3.5-flash-lite` (current generally-available,
  low-cost model as of July 2026 — Gemini model names change
  frequently; if this ever 404s, check ai.google.dev/gemini-api/docs/models
  for the current recommended lite/flash model and swap the model ID
  in `api/extract-intent.js`).
