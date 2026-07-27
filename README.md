# FLOW Voice Agent

A minimal, Siri-style voice assistant for checking bunker supply
availability at Fujairah (FUJ) and Khor Fakkan (KFK). Tap the orb,
ask something casual — it holds a real back-and-forth conversation,
asks for missing details, and checks both scheduling AND current
fuel stock before answering. Never lets the AI invent the answer —
the actual feasibility math is deterministic, tested code.

Not connected to the live FLOW app or its database. Fully standalone.

## What's in this version
- **Fixed: schedule upload was silently reading zero rows** — real
  FLOW schedule exports have a title/summary block before the actual
  column headers (headers sit on row 5, not row 1). The parser
  previously assumed row 1 was always the header row, so it never
  found the real columns at all. Now it scans for the actual header
  row first. Verified against a real exported FLOW_Schedule file —
  correctly extracts all vessel/time/port rows
- **Won't pretend to book anything** — this tool only checks
  availability, it can't actually save/confirm a real booking. If
  asked to "book it," it now says so plainly instead of replying
  "Got it" as if something was saved somewhere
- **Barge fleet configuration** — editable capacity, transfer rate, and
  hose-connect time per barge in Settings, matching the same fields
  the main FLOW app tracks. Pre-filled with calibrated defaults;
  capacity is a placeholder (4000 MT VLSFO / 1000 MT LSMGO) — set it
  to your barges' real tank capacity for an accurate check. Requests
  that exceed a barge's physical capacity are now flagged specifically
  ("that's more than FNSA 10 can physically hold") rather than just
  failing silently
- **Faster voice** — sped up from the previous "humanized" pacing
- **Clearer upload diagnostics** — if a file upload doesn't seem to
  work, open the browser console (F12) — every upload now logs what
  file was picked and whether the PDF/Excel reader libraries loaded
  correctly, making it much faster to tell what actually broke
- **Full general-assistant capability** — answers anything, like Siri
  or Gemini would (general knowledge, calculations, casual chat), not
  restricted to canned scheduling replies
- **Grounded schedule/stock Q&A** — the agent now sees your actual
  uploaded committed ops and ROB on every turn, so questions like
  "what's booked this week" or "how much fuel is on FNSA 10" get
  answered from your real data — never invented. If the data isn't
  loaded, it says so instead of guessing
- **"Hey FLOW" wake word** — enable "Always Listening" in Settings and
  it responds to "Hey FLOW", "Hello FLOW", "Hi FLOW", or just "FLOW"
  without tapping anything. Uses your mic continuously while enabled
  and the tab is open — off by default, and clearly labelled as using
  the mic continuously when you turn it on
- **PDF position report support** — upload a PDF alongside Excel/CSV.
  Extracts vessel/time rows via text-pattern matching (pdf.js). PDF
  layouts vary a lot, so this is best-effort — Excel/CSV still parses
  more reliably. The upload status message tells you how many rows it
  found so you can sanity-check before trusting it
- **Grounded in your real operation** — only FNSA 10 / FNSA 11, only
  FUJ / KFK. The AI is explicitly told this, so it can't hallucinate
  a random port or barge that doesn't exist in your fleet
- **ROB (Remaining On Board) awareness** — set current stock manually
  per barge/fuel, or auto-fill it from a Position Report upload. The
  agent now checks stock, not just scheduling — if the timing's free
  but there isn't enough fuel on board, it tells you that specifically
  instead of giving a false "yes"
- **Multi-turn conversation** — asks a clarifying question instead of
  failing on an incomplete request, remembers context across turns
- **General chat handling** — greetings, thanks, small talk get a
  natural reply instead of an error
- **Humanized voice** — female-voice preference where available,
  slightly slower/more natural pacing, and varied phrasing so it
  doesn't repeat the exact same sentence shape every time
- **Minimalist Siri-style UI** — dark, centered orb, chat bubbles,
  settings tucked away instead of cluttering the main screen
- **Position Report upload** — .xlsx/.csv upload that fills in both
  committed ops (vessel/start/ETC) AND current ROB per barge, if the
  report has the right columns

## How it works
- `index.html` — the voice/text UI, chat state, position report
  parsing (via SheetJS, all client-side — your file never leaves
  your browser except the fields used for the math), and the real
  feasibility math (ported verbatim from the FLOW app's tested logic)
- `api/extract-intent.js` — small serverless backend. Holds your
  Gemini API key securely server-side. Handles natural conversation
  and extracts structured details once there's enough info — never
  computes the actual answer, and is explicitly told your real fleet
  (FNSA 10/11) and ports (FUJ/KFK) so it can't invent others

## Setup — do this once

### 1. Get a Gemini API key (free tier, no card required)
1. **aistudio.google.com** → sign in → **Get API key** → **Create API key**
2. Copy it — paste into Vercel in step 3, never into any file here

### 2. Push this repo to GitHub
Push all these files (flat, at the repo root) to a new GitHub repo.

### 3. Deploy to Vercel
1. vercel.com → **Add New → Project** → select this repo
2. Framework Preset: **Other**
3. **Settings → Environment Variables** → add `GEMINI_API_KEY` →
   **Save**
4. **Deployments** → latest → **⋯ → Redeploy** (if the variable was
   added after the first deploy)

## Verification status
Backend and frontend both pass syntax checks; the core feasibility
math (gap-finding, timing evaluation) has been functionally tested
with real scenarios. **The live voice → AI conversation → answer path,
and the ROB/stock-shortfall branch specifically, have not been tested
against a real deployment** — this environment has no microphone and
no network access to Google's API. Deploy and try it for real,
including a case where you deliberately set ROB below the requested
quantity to confirm the shortfall message reads correctly. Share
exact errors (browser console for frontend, Vercel function logs for
backend) for a precise fix.

## Notes
- Voice recognition needs Chrome/Edge — Firefox/Safari support is
  limited. Text input always works as a fallback.
- Female voice selection depends on what voices your OS/browser
  actually ships — not guaranteed on every device.
- Position Report upload looks for columns matching: vessel/ship name,
  barge, port, a start/alongside/ETA time, a completed/ETC time, and
  (if present) ROB/remaining/stock columns per barge. Column names
  don't need to match exactly — flexible keyword matching.
- ROB left blank means "unknown" — the agent won't block an answer on
  stock it doesn't have a number for, only when you've actually told
  it a number that's too low.
- Model used: `gemini-3.5-flash-lite` (current as of July 2026 —
  check ai.google.dev/gemini-api/docs/models if it ever 404s).
