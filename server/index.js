import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Readable } from 'stream';

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true }));

// ── Perplexity proxy ──────────────────────────────────────────────────────────
app.post('/api/perplexity', async (req, res) => {
  try {
    const upstream = await fetch('https://api.perplexity.ai/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Anthropic proxy (SSE streaming pass-through) ──────────────────────────────
app.post('/api/anthropic', async (req, res) => {
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ ...req.body, stream: true }),
    });

    res.writeHead(upstream.status, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    });

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`REKA server running on port ${PORT}`));
