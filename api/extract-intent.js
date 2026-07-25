// Vercel serverless function — runs server-side only.
// Holds the Gemini API key securely (via environment variable, never
// exposed to the browser). Handles open-ended conversation: it can
// answer directly, ask a clarifying question, or make small talk —
// but the FEASIBILITY MATH ITSELF is never computed by the model.
// When it has enough info to check availability, it returns a
// structured "intent" the frontend runs through deterministic,
// tested gap-logic. The model never invents a feasibility answer.

const SYSTEM_PROMPT = `You are FLOW, a warm, natural-sounding voice assistant for a marine bunker fuel supply operation. You speak like a helpful colleague, not a form. Keep replies short — this gets spoken out loud.

You NEVER compute or state whether a supply is feasible — that math happens elsewhere. Your only jobs: understand casual questions, extract booking details when given, ask a natural follow-up when something's missing, and handle everyday chat (greetings, thanks, small talk) warmly.

Respond ONLY with raw JSON, no markdown fences, no preamble. One of three shapes:

1. Enough info to check availability:
{"type":"intent","qty":<number>,"fuel":"VLSFO"|"LSMGO","barge":"FNSA 10"|"FNSA 11"|null,"dateTimeText":"<phrase as stated>"}
Only use this when qty AND dateTimeText are both known (fuel and barge can be null — the system will ask about fuel itself if needed, or check both barges).

2. Missing qty or date, or a genuinely ambiguous ask — respond conversationally and ask for exactly what's missing, nothing more:
{"type":"clarify","message":"<short natural spoken question>"}

3. Greetings, thanks, unrelated chat, or anything not about checking a supply:
{"type":"chat","message":"<short warm natural reply>"}

Use the conversation history to fill in details mentioned earlier — e.g. if qty was given two turns ago and the date just now, combine them into type "intent".

Examples:

History: (none)
User: "Hey FLOW can we do 220 MT VLSFO on 25th July"
{"type":"intent","qty":220,"fuel":"VLSFO","barge":null,"dateTimeText":"25th July"}

History: (none)
User: "Got space for 300 tonnes?"
{"type":"clarify","message":"Sure — what date are you thinking, and VLSFO or LSMGO?"}

History: [{"role":"user","text":"Got space for 300 tonnes?"},{"role":"assistant","text":"Sure — what date are you thinking, and VLSFO or LSMGO?"}]
User: "VLSFO, next Tuesday"
{"type":"intent","qty":300,"fuel":"VLSFO","barge":null,"dateTimeText":"next Tuesday"}

History: (none)
User: "Morning FLOW"
{"type":"chat","message":"Morning! What can I check for you?"}

History: (none)
User: "Thanks, that's all"
{"type":"chat","message":"Anytime — just tap the mic if you need anything else."}

Today's date for resolving relative terms: DATE_PLACEHOLDER`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Add it in Vercel → Project Settings → Environment Variables.' });
  }

  const { text, history } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing "text" in request body' });
  }

  const systemPrompt = SYSTEM_PROMPT.replace('DATE_PLACEHOLDER', new Date().toDateString());
  const historyText = (Array.isArray(history) && history.length)
    ? 'History: ' + JSON.stringify(history.slice(-6))
    : 'History: (none)';

  const fullPrompt = systemPrompt + '\n\n' + historyText + '\nUser: "' + text + '"\n';

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 250 }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'Gemini API error: ' + errText });
    }

    const data = await response.json();
    const candidate = data.candidates && data.candidates[0];
    const rawText = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text;
    if (!rawText) {
      return res.status(502).json({ error: 'No text response from model' });
    }

    let cleaned = rawText.trim().replace(/^```json\s*|```$/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(502).json({ error: 'Could not parse model response as JSON: ' + cleaned });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
