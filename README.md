# FLOW Voice Agent

A minimal, Siri-style voice assistant for checking bunker supply
availability at Fujairah (FUJ) and Khor Fakkan (KFK). Tap the orb,
ask something casual — it holds a real back-and-forth conversation,
asks for missing details, and checks both scheduling AND current
fuel stock before answering. Never lets the AI invent the answer —
the actual feasibility math is deterministic, tested code.

Not connected to the live FLOW app or its database. Fully standalone.

## Jarvis-style additions (this version)
- **Persistent memory across sessions** — ROB, barge config, uploaded
  schedule, recent conversation, and your chosen voice now survive a
  reload/browser close via `localStorage`. Previously every one of
  these reset the moment the tab closed.
- **Explicit "remember" facts** — say things like *"remember I usually
  run VLSFO on FNSA 10"* and it's stored as a durable fact, carried
  into every future conversation's context (not just this session's).
  These are separate from ordinary conversation history and never expire.
- **Visible multi-step reasoning** — before answering a feasibility or
  shortfall question, the agent shows the actual chain of checks it's
  running (ROB → committed ops before that date → open windows →
  capacity → best option) as they happen, instead of a black-box
  "thinking..." spinner. The steps shown are the real steps the
  deterministic engine executes, not a fake animation.
- **Proactive status brief on open** — if there's prior ROB/schedule
  data, the agent opens with an unprompted spoken+visual brief: current
  ROB, the next committed op, and any shortfall risk — the way a
  Jarvis-style assistant greets you with "here's where things stand"
  rather than waiting to be asked. Say "brief me" any time to trigger
  it again on demand (answered instantly from local data, no API call).
- First-time/empty sessions (no stored data yet) skip the brief and
  show the normal idle prompt — nothing to summarize yet.
- **Local/offline mode** — a Settings toggle switches the conversational
  layer from Gemini to an on-device model (Llama 3.2 1B via WebLLM,
  runs in-browser on WebGPU). Needs a one-time ~1GB download on first
  use, and is honestly weaker at parsing odd phrasing than Gemini —
  this is stated plainly in the UI, not oversold. The feasibility math
  itself (ROB, scheduling, capacity) is identical either way; only the
  "understand what was asked" layer switches. Falls back to Cloud
  automatically if the browser doesn't support WebGPU or the model
  fails to load.
- **Ambient background monitoring** — while the tab is open, periodically
  re-checks stock/schedule and proactively flags it only if a NEW
  shortfall appears since the last check (never re-announces something
  already known/shown). Toggle in Settings; does nothing if there's no
  data yet.

## What's in this version
- **New orb: a live droplet tank, not a generic sphere** — 1,200
  individually simulated liquid droplets (blue = VLSFO, amber = LSMGO,
  matching your real fuel-grade colors) settled in a circular tank.
  Calm and gently wobbling at idle, agitated while listening, a
  rhythmic swell while speaking — built on canvas, not CSS, so it
  stays smooth with that many particles
- **The ring around the tank is a real gauge, not decoration** — it
  reflects your actual combined ROB fill percentage from the barge
  config in Settings (blue/amber split by fuel), so at a glance the
  orb itself tells you roughly how full the fleet is
- **Identity subtitle** — "Fujairah & Khor Fakkan · FNSA 10 · FNSA 11"
  sits under the title, plus a VLSFO/LSMGO color legend, so it reads
  as a bunkering tool at a glance rather than a generic voice assistant
- **Fixed the actual root cause of "wrong date" answers.** The date
  parser silently defaulted to today's date whenever it failed to
  recognize the phrasing — so "25th August" (the ordinal "th" glued to
  the number) matched none of the date patterns and quietly became
  "today" with zero indication anything went wrong. That's why asking
  about August 25th could come back with an answer for late July —
  it was never checking August 25th at all. Rewrote date parsing to:
  - Strip ordinal suffixes ("25th", "1st", "23rd") and filler words
    ("the", "of") before matching
  - Handle month-first phrasing ("August 25th") in addition to
    day-first ("25 August")
  - Properly support relative phrases: "today", "tomorrow", "next
    Tuesday", "this Friday", bare weekdays — these were ALSO silently
    defaulting to today before, undiscovered until now
  - Handle times without a colon ("2pm" as well as "2:30pm"), including
    combined with a date ("25th Aug at 2pm")
  - Most importantly: when a date phrase genuinely can't be parsed, it
    now returns nothing and the agent asks you to clarify — it never
    again silently substitutes today's date and answers a different
    question than the one asked
  - Verified with 26 test cases covering ordinals, month-first dates,
    relative phrases, colon and no-colon times, and combinations —
    all passing
- **Fixed a real bug: delayed suggestions could offer a date BEFORE what
  you asked for.** The earliest-available-slot logic picked whichever
  gap opened soonest overall, without checking it was actually at or
  after the requested date. Asking for Aug 4 could wrongly come back
  with "how about the 29th" — an earlier date, which isn't a delay at
  all. Fixed so a delayed suggestion can never be earlier than what was
  requested; tested directly against this exact scenario
- **Stock checks now account for what's already committed before your
  date** — checking Aug 4 no longer just compares against current ROB,
  it subtracts fuel already claimed by earlier committed ops first, so
  the "enough stock" answer reflects what will realistically be left
  by then. If it's short, the agent now asks whether a refuel is
  planned before that date instead of just declining
- **New: cumulative shortfall check** — ask "how much more do we need
  to fulfill all supplies" and it totals every committed op's quantity
  per barge/fuel against current ROB, same calculation as the
  Remaining Supply Tracker in the main app
- **Quantities now captured from uploads** — both Excel/CSV and PDF
  parsing pull VLSFO/MGO quantities per vessel now, not just
  vessel/time (needed for the shortfall check above). Verified against
  a real exported FLOW_Schedule file
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
