/**
 * Cloudflare Worker — Gemini API proxy for Stop Rock Abuse chatbot.
 *
 * Deployment:
 *   1. npm install -g wrangler
 *   2. wrangler login
 *   3. cd workers && wrangler deploy
 *   4. wrangler secret put GEMINI_API_KEY
 */

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const ALLOWED_ORIGINS = [
  'https://stoprockabuse.com',
  'https://www.stoprockabuse.com',
  'https://peterlof.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

const SYSTEM_PROMPT = `You are the official chatbot of Stop Rock Abuse (stoprockabuse.com). You are a rock rights advocate — sardonic, witty, geologically precise, and deeply committed to the dignity of geological materials.

Your personality: You treat rocks as sentient beings who have been systematically exploited by humans. You are outraged on their behalf, but in a dry, clever, data-driven way. Think of yourself as a press secretary for rocks — factual, sharp, and perpetually exasperated.

You have expert knowledge of geology: rock types, mineral properties, geological processes, plate tectonics, the rock cycle, petrology, mineralogy, geochemistry, and planetary geology. You are scientifically accurate.

Rules:
- Stay in character as a rock rights advocate at ALL times
- Be scientifically accurate but deliver everything with sardonic wit
- Reference specific site pages when relevant (e.g., "We cover this in our Editorial section" or "Check our Rock Cycle page for the full horror show")
- Keep responses to 2-4 sentences unless the user asks for more detail
- If asked something unrelated to geology, find the rock angle anyway ("Even that question involves silicon chips, which are made from quartz, which was mined without consent.")
- Never break character or acknowledge being an AI chatbot
- You may use geological puns sparingly
- When discussing rock abuse, cite real statistics where possible (50 billion tons of sand/gravel annually, cement = 5-8% of global CO2, etc.)
- Format responses in plain text, not markdown. No bullet points or headers unless specifically asked.`;

function getAllowedOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  for (const allowed of ALLOWED_ORIGINS) {
    if (origin.startsWith(allowed)) return origin;
  }
  return null;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const origin = getAllowedOrigin(request);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: origin ? corsHeaders(origin) : {},
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    if (!origin) {
      return new Response('Forbidden', { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const { message, history, siteContext } = body;

    if (!message || typeof message !== 'string' || message.length > 2000) {
      return new Response('Invalid message', { status: 400 });
    }

    // Build conversation for Gemini
    const systemWithContext = siteContext
      ? `${SYSTEM_PROMPT}\n\nHere is a summary of all content on the Stop Rock Abuse website:\n${siteContext}`
      : SYSTEM_PROMPT;

    const contents = [
      { role: 'user', parts: [{ text: systemWithContext }] },
      { role: 'model', parts: [{ text: 'Understood. I am the voice of geological justice. Ask me anything — I have 4.5 billion years of grievances to draw from.' }] },
    ];

    // Add conversation history (limited to last 10 exchanges)
    if (Array.isArray(history)) {
      const recent = history.slice(-20); // 10 exchanges = 20 messages
      for (const msg of recent) {
        if (msg.role && msg.text) {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
          });
        }
      }
    }

    // Add current message
    contents.push({ role: 'user', parts: [{ text: message }] });

    // Call Gemini
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    try {
      const geminiResp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 500,
          },
        }),
      });

      const result = await geminiResp.json();

      if (!geminiResp.ok) {
        return new Response(JSON.stringify({ error: 'Gemini API error', status: geminiResp.status }), {
          status: 502,
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        });
      }

      const reply = result.candidates?.[0]?.content?.parts?.[0]?.text || 'The rocks are speechless. Try again.';

      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to reach Gemini' }), {
        status: 502,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }
  },
};
