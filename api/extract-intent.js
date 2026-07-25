// Vercel serverless function — runs server-side only.
// Holds the Gemini API key securely (via environment variable, never
// exposed to the browser) and does ONE job: extract structured fields
// from a casual spoken/typed question. It never computes the actual
// feasibility answer — that math happens deterministically in the
// frontend, using the same tested gap-logic ported from the FLOW app.

const SYSTEM_PROMPT = `You extract structured fields from a casual bunker-fuel-supply question.

Respond ONLY with raw JSON, no markdown fences, no preamble, no explanation.

Fields:
- qty: number (metric tonnes). null if not mentioned or unclear.
- fuel: "VLSFO" or "LSMGO". null if not mentioned — do NOT guess a default.
- barge: "FNSA 10" or "FNSA 11". null if not specified.
- dateTimeText: string — the date/time phrase exactly AS STATED (e.g. "25th July", "next Tuesday 2pm", "tomorrow morning"). Do not resolve it into an actual date yourself — extract the phrase verbatim. null if no date/time mentioned at all.

Examples:

Q: "Hey FLOW can we do 220 MT VLSFO on 25th July"
A: {"qty":220,"fuel":"VLSFO","barge":null,"dateTimeText":"25th July"}

Q: "Got space for 300 tonnes of gasoil on the 28th?"
A: {"qty":300,"fuel":"LSMGO","barge":null,"dateTimeText":"the 28th"}

Q: "Is FNSA 11 free tomorrow morning for a thousand tonnes?"
A: {"qty":1000,"fuel":null,"barge":"FNSA 11","dateTimeText":"tomorrow morning"}

Q: "Can we fit 500 next Tuesday at 2pm on ten"
A: {"qty":500,"fuel":null,"barge":"FNSA 10","dateTimeText":"next Tuesday at 2pm"}

Q: "What's our availability looking like this week"
A: {"qty":null,"fuel":null,"barge":null,"dateTimeText":null}

Q: "Around 450 mt fuel oil, end of the month sometime"
A: {"qty":450,"fuel":"VLSFO","barge":null,"dateTimeText":"end of the month"}

Note: "fuel oil", "HSFO-style bunker", "black oil" language without a grade number usually means VLSFO in this context, but if genuinely ambiguous, return null rather than guess.

Today's date for resolving relative terms like "tomorrow" or "next Tuesday": DATE_PLACEHOLDER`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Add it in Vercel → Project Settings → Environment Variables.' });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing "text" in request body' });
  }

  const systemPrompt = SYSTEM_PROMPT.replace('DATE_PLACEHOLDER', new Date().toDateString());

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\nQ: "' + text + '"\nA:' }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
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
    let intent;
    try {
      intent = JSON.parse(cleaned);
    } catch (e) {
      return res.status(502).json({ error: 'Could not parse model response as JSON: ' + cleaned });
    }

    return res.status(200).json(intent);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
