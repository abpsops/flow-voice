# FLOW Voice Agent

A minimal, Siri-style voice assistant for checking bunker supply
availability. Tap the orb, ask something casual — it can hold a real
back-and-forth conversation, ask for missing details, or just chat —
and gives you a real feasibility answer using deterministic, tested
math (never lets the AI invent the answer).

Not connected to the live FLOW app or its database. Fully standalone.

## What's new in this version
- **Multi-turn conversation** — the assistant can ask a clarifying
  question ("what date were you thinking?") instead of failing on an
  incomplete request, and remembers context across turns
- **General chat handling** — greetings, thanks, small talk get a
  natural reply instead of an error
- **Female voice preference** — automatically picks a female-sounding
  system voice if one's available (browser/OS dependent); choose a
  different one under Settings
- **Minimalist Siri-style UI** — dark, centered orb, chat bubbles,
  settings tucked away instead of cluttering the main screen
- **Schedule upload** — upload your current schedule as .xlsx/.csv
  under Settings instead of manually typing in each committed op. It
  looks for columns matching vessel/ship name, a start/alongside/ETA
  time, and a completed/ETC time (case-insensitive, flexible matching)

## How it works
- `index.html` — the voice/text UI, chat state, schedule parsing
  (via SheetJS, all client-side — your schedule file never leaves
  your browser except the extracted vessel/time fields used for the
  math itself), and the real feasibility math (ported verbatim from
  the FLOW app's own tested logic)
- `api/extract-intent.js` — small serverless backend. Holds your
  Gemini API key securely server-side. Handles natural conversation
  (chat / clarify / intent) but never computes the actual answer —
  only extracts what you're asking for once there's enough info

## Setup — do this once

### 1. Get a Gemini API key (free tier, no card required)
1. **aistudio.google.com** → sign in → **Get API key** → **Create API key**
2. Copy it — paste into Vercel in step 3, never into any file here

### 2. Push this repo to GitHub
Push all these files (flat, at the repo root) to a new GitHub repo.

### 3. Deploy to Vercel
1. vercel.com → **Add New → Project** → select this repo
2. Framework Preset: **Other**
3. **Settings → Environment Variables** → add `GEMINI_API_KEY` with
   your key → **Save**
4. **Deployments** → latest → **⋯ → Redeploy** (if you added the
   variable after the first deploy)

## Verification status
Backend and frontend both pass syntax checks; the core feasibility
math has been functionally tested with real scenarios. **The live
voice → AI conversation → answer path has not been tested against a
real deployment** — this environment has no microphone and no network
access to Google's API. Deploy and try it for real; share exact
errors (browser console for frontend, Vercel function logs for
backend) for a precise fix.

## Notes
- Voice recognition needs Chrome/Edge — Firefox/Safari support is
  limited. Text input always works as a fallback.
- Female voice selection depends on what voices your OS/browser
  actually ships — not guaranteed on every device. Check the Settings
  panel to see/change what's available.
- Schedule upload expects a spreadsheet with columns roughly matching
  vessel name / start time / completion time — column names don't
  need to match exactly, it looks for common keywords.
- Model used: `gemini-3.5-flash-lite` (current as of July 2026 —
  Gemini model names change; check ai.google.dev/gemini-api/docs/models
  if it ever 404s).
