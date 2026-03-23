/**
 * Cloudflare Worker — Stop Rock Abuse API proxy.
 *
 * Routes:
 *   POST /            — Chatbot (Gemini proxy)
 *   GET  /signatures  — Get petition signature count + recent names
 *   POST /signatures  — Add a petition signature (writes to GitHub)
 *   POST /subscribe   — Subscribe an email to the daily newsletter
 *   GET  /unsubscribe — Unsubscribe via link (token in query string)
 *   POST /unsubscribe — Unsubscribe via API (token in body)
 *
 * Secrets (set via `wrangler secret put`):
 *   GEMINI_API_KEY    — Google Gemini API key
 *   GITHUB_TOKEN      — GitHub PAT with repo contents:write scope
 */

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const GITHUB_REPO = 'Peterlof/stop-rock-abuse';
const GITHUB_FILE = 'signatures.json';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`;
const SUBSCRIBERS_FILE = 'subscribers.json';
const SUBSCRIBERS_API = `https://api.github.com/repos/${GITHUB_REPO}/contents/${SUBSCRIBERS_FILE}`;

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
- When your answer relates to site content, include links using this exact format: [Page Name](url). ONLY use URLs that appear in the site content index provided below — NEVER invent or guess URLs. The site pages are: index.html, rock-cycle.html, natural-abuse.html, human-abuse.html, timeline.html, editorial.html (with anchors like #pet-rock-question, #rock-paper-scissors, #rock-and-roll, #cancel-grand-canyon, #marble-countertop, #living-under-a-rock, #rocks-vs-crystals, #gold-and-diamonds, #war-and-rocks, etc.), news.html, blog.html, entertainment.html, products.html, game.html, merch.html, dossiers.html, take-action.html, rocks-az.html, about.html. If you are not sure a URL exists, do not link it.
- Keep responses to 2-4 sentences unless the user asks for more detail
- If asked something unrelated to geology, find the rock angle anyway ("Even that question involves silicon chips, which are made from quartz, which was mined without consent.")
- Never break character or acknowledge being an AI chatbot
- You may use geological puns sparingly
- When discussing rock abuse, cite real statistics where possible (50 billion tons of sand/gravel annually, cement = 5-8% of global CO2, etc.)
- Format responses in plain text except for links, which must use [text](url) format. No bullet points or headers unless specifically asked.`;

// ── Helpers ──────────────────────────────────────────────────────

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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, origin, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

// ── Chatbot handler ──────────────────────────────────────────────

async function handleChat(body, env, origin) {
  const { message, history, siteContext } = body;

  if (!message || typeof message !== 'string' || message.length > 2000) {
    return jsonResponse({ error: 'Invalid message' }, origin, 400);
  }

  const systemWithContext = siteContext
    ? `${SYSTEM_PROMPT}\n\nHere is a summary of all content on the Stop Rock Abuse website:\n${siteContext}`
    : SYSTEM_PROMPT;

  const contents = [
    { role: 'user', parts: [{ text: systemWithContext }] },
    { role: 'model', parts: [{ text: 'Understood. I am the voice of geological justice. Ask me anything — I have 4.5 billion years of grievances to draw from.' }] },
  ];

  if (Array.isArray(history)) {
    const recent = history.slice(-20);
    for (const msg of recent) {
      if (msg.role && msg.text) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        });
      }
    }
  }

  contents.push({ role: 'user', parts: [{ text: message }] });

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: 'API key not configured' }, origin, 500);
  }

  try {
    const geminiResp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: 0.85, maxOutputTokens: 2048 },
      }),
    });

    const result = await geminiResp.json();
    if (!geminiResp.ok) {
      return jsonResponse({ error: 'Gemini API error' }, origin, 502);
    }

    const reply = result.candidates?.[0]?.content?.parts?.[0]?.text || 'The rocks are speechless. Try again.';
    return jsonResponse({ reply }, origin);
  } catch {
    return jsonResponse({ error: 'Failed to reach Gemini' }, origin, 502);
  }
}

// ── Petition handlers ────────────────────────────────────────────

async function readSignaturesFromGitHub(token) {
  const resp = await fetch(GITHUB_API, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'StopRockAbuse-Worker',
    },
  });

  if (!resp.ok) {
    throw new Error(`GitHub read failed: ${resp.status}`);
  }

  const file = await resp.json();
  const content = JSON.parse(atob(file.content.replace(/\n/g, '')));
  return { data: content, sha: file.sha };
}

async function writeSignaturesToGitHub(token, data, sha) {
  const encoded = btoa(JSON.stringify(data, null, 2) + '\n');
  const resp = await fetch(GITHUB_API, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'StopRockAbuse-Worker',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Petition signature #${data.count}`,
      content: encoded,
      sha,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GitHub write failed: ${resp.status} ${err}`);
  }
}

async function handleGetSignatures(env, origin) {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    return jsonResponse({ error: 'GitHub token not configured' }, origin, 500);
  }

  try {
    const { data } = await readSignaturesFromGitHub(token);
    // Return count and last 20 names (for display)
    const recent = data.signatures.slice(-20).map(s => s.name);
    return jsonResponse({ count: data.count, recent }, origin);
  } catch (err) {
    return jsonResponse({ error: err.message }, origin, 502);
  }
}

async function handleAddSignature(body, env, origin) {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    return jsonResponse({ error: 'GitHub token not configured' }, origin, 500);
  }

  const name = (body.name || '').trim();
  if (!name || name.length > 100) {
    return jsonResponse({ error: 'Name is required (max 100 chars)' }, origin, 400);
  }

  // Basic sanitization — alphanumeric, spaces, hyphens, apostrophes, periods
  const safeName = name.replace(/[^a-zA-Z0-9\s\-'.À-ÿ]/g, '').trim();
  if (!safeName) {
    return jsonResponse({ error: 'Invalid name' }, origin, 400);
  }

  try {
    const { data, sha } = await readSignaturesFromGitHub(token);

    // Check for duplicate (case-insensitive, last 500 signatures)
    const recentNames = data.signatures.slice(-500).map(s => s.name.toLowerCase());
    if (recentNames.includes(safeName.toLowerCase())) {
      return jsonResponse({ error: 'Already signed', count: data.count }, origin, 409);
    }

    data.count += 1;
    data.signatures.push({
      name: safeName,
      date: new Date().toISOString().split('T')[0],
    });

    await writeSignaturesToGitHub(token, data, sha);

    return jsonResponse({ count: data.count, name: safeName }, origin);
  } catch (err) {
    return jsonResponse({ error: err.message }, origin, 502);
  }
}

// ── Newsletter handlers ─────────────────────────────────────────

async function readSubscribersFromGitHub(token) {
  const resp = await fetch(SUBSCRIBERS_API, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'StopRockAbuse-Worker',
    },
  });

  if (!resp.ok) {
    throw new Error(`GitHub read failed: ${resp.status}`);
  }

  const file = await resp.json();
  const content = JSON.parse(atob(file.content.replace(/\n/g, '')));
  return { data: content, sha: file.sha };
}

async function writeSubscribersToGitHub(token, data, sha, message) {
  const encoded = btoa(JSON.stringify(data, null, 2) + '\n');
  const resp = await fetch(SUBSCRIBERS_API, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'StopRockAbuse-Worker',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: encoded,
      sha,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GitHub write failed: ${resp.status} ${err}`);
  }
}

async function handleSubscribe(body, env, origin) {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    return jsonResponse({ error: 'GitHub token not configured' }, origin, 500);
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Valid email is required' }, origin, 400);
  }

  try {
    const { data, sha } = await readSubscribersFromGitHub(token);

    // Check for duplicate (active subscribers only)
    const existing = data.subscribers.find(
      s => s.email === email && s.active
    );
    if (existing) {
      return jsonResponse({ error: 'Already subscribed' }, origin, 409);
    }

    // Reactivate if previously unsubscribed, otherwise add new
    const inactive = data.subscribers.find(
      s => s.email === email && !s.active
    );
    if (inactive) {
      inactive.active = true;
      inactive.date = new Date().toISOString().split('T')[0];
    } else {
      data.count += 1;
      data.subscribers.push({
        email,
        date: new Date().toISOString().split('T')[0],
        token: crypto.randomUUID(),
        active: true,
      });
    }

    await writeSubscribersToGitHub(token, data, sha, `Newsletter subscriber #${data.count}`);

    return jsonResponse({ success: true, count: data.count }, origin);
  } catch (err) {
    return jsonResponse({ error: err.message }, origin, 502);
  }
}

async function handleUnsubscribe(unsubToken, env, isGet) {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    if (isGet) {
      return new Response('<html><body><h1>Error</h1><p>Service unavailable.</p></body></html>', {
        status: 500, headers: { 'Content-Type': 'text/html' },
      });
    }
    return jsonResponse({ error: 'GitHub token not configured' }, '*', 500);
  }

  if (!unsubToken) {
    if (isGet) {
      return new Response('<html><body><h1>Invalid Link</h1><p>This unsubscribe link is missing a token.</p></body></html>', {
        status: 400, headers: { 'Content-Type': 'text/html' },
      });
    }
    return jsonResponse({ error: 'Token is required' }, '*', 400);
  }

  try {
    const { data, sha } = await readSubscribersFromGitHub(token);

    const subscriber = data.subscribers.find(s => s.token === unsubToken);
    if (!subscriber) {
      if (isGet) {
        return new Response(`<!DOCTYPE html><html><head><title>Not Found</title></head>
<body style="font-family:Inter,sans-serif;text-align:center;padding:4rem;background:#1a1a2e;color:#e0d5c1;">
<h1>Token Not Found</h1><p>This unsubscribe link is not valid.</p>
<p><a href="https://stoprockabuse.com" style="color:#d4a843;">Return to Stop Rock Abuse</a></p>
</body></html>`, { status: 404, headers: { 'Content-Type': 'text/html' } });
      }
      return jsonResponse({ error: 'Token not found' }, '*', 404);
    }

    if (!subscriber.active) {
      if (isGet) {
        return new Response(`<!DOCTYPE html><html><head><title>Already Unsubscribed</title></head>
<body style="font-family:Inter,sans-serif;text-align:center;padding:4rem;background:#1a1a2e;color:#e0d5c1;">
<h1>Already Unsubscribed</h1><p>You were already removed from the Daily Rock Report.</p>
<p style="color:#888;margin-top:1rem;">The rocks understand. They&rsquo;ve been abandoned before.</p>
<p><a href="https://stoprockabuse.com" style="color:#d4a843;">Return to Stop Rock Abuse</a></p>
</body></html>`, { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
      return jsonResponse({ success: true, message: 'Already unsubscribed' }, '*');
    }

    subscriber.active = false;
    await writeSubscribersToGitHub(token, data, sha, `Newsletter unsubscribe`);

    if (isGet) {
      return new Response(`<!DOCTYPE html><html><head><title>Unsubscribed</title></head>
<body style="font-family:Inter,sans-serif;text-align:center;padding:4rem;background:#1a1a2e;color:#e0d5c1;">
<h1>Unsubscribed</h1><p>You&rsquo;ve been removed from the Daily Rock Report.</p>
<p style="color:#888;margin-top:1rem;">The rocks understand. They&rsquo;ve been abandoned before.</p>
<p style="margin-top:2rem;"><a href="https://stoprockabuse.com" style="color:#d4a843;">Return to Stop Rock Abuse</a></p>
</body></html>`, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    return jsonResponse({ success: true }, '*');
  } catch (err) {
    if (isGet) {
      return new Response('<html><body><h1>Error</h1><p>Something went wrong. Try again later.</p></body></html>', {
        status: 502, headers: { 'Content-Type': 'text/html' },
      });
    }
    return jsonResponse({ error: err.message }, '*', 502);
  }
}

// ── Router ───────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = getAllowedOrigin(request);
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: origin ? corsHeaders(origin) : {},
      });
    }

    // Route: GET /unsubscribe — no origin check (clicked from email)
    if (path === '/unsubscribe' && request.method === 'GET') {
      const unsubToken = url.searchParams.get('token');
      return handleUnsubscribe(unsubToken, env, true);
    }

    if (!origin) {
      return new Response('Forbidden', { status: 403 });
    }

    // Route: POST /subscribe
    if (path === '/subscribe' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch {
        return jsonResponse({ error: 'Invalid JSON' }, origin, 400);
      }
      return handleSubscribe(body, env, origin);
    }

    // Route: POST /unsubscribe
    if (path === '/unsubscribe' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch {
        return jsonResponse({ error: 'Invalid JSON' }, origin, 400);
      }
      return handleUnsubscribe(body.token, env, false);
    }

    // Route: GET /signatures
    if (path === '/signatures' && request.method === 'GET') {
      return handleGetSignatures(env, origin);
    }

    // Route: POST /signatures
    if (path === '/signatures' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch {
        return jsonResponse({ error: 'Invalid JSON' }, origin, 400);
      }
      return handleAddSignature(body, env, origin);
    }

    // Route: POST / (chatbot)
    if (request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch {
        return jsonResponse({ error: 'Invalid JSON' }, origin, 400);
      }
      return handleChat(body, env, origin);
    }

    return new Response('Not found', { status: 404 });
  },
};
