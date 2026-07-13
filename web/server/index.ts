import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PROVIDERS, resolveKey, chat } from './diamondgpt.ts';
import { fetchPercentiles } from './savant.ts';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/providers', (_req, res) => {
    res.json({
      providers: PROVIDERS.map((p) => ({
        id: p.id,
        label: p.label,
        model: p.model,
        hasServerKey: !!(process.env[p.envVar] && process.env[p.envVar]!.trim()),
      })),
    });
  });

  app.post('/api/chat', async (req, res) => {
    const { provider, apiKey, sessionId, message } = (req.body ?? {}) as {
      provider?: string; apiKey?: string; sessionId?: string; message?: string;
    };
    if (!provider || !PROVIDERS.some((p) => p.id === provider)) {
      return res.status(400).json({ error: 'unknown or missing provider' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    const key = resolveKey(provider, apiKey);
    if (!key) {
      return res.status(400).json({ error: `No API key for ${provider}. Enter a key or set the server env var.` });
    }
    try {
      const result = await chat(provider, key, sessionId, message);
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/savant/percentiles/:playerId', async (req, res) => {
    const type = req.query.type === 'pitcher' ? 'pitcher' : 'batter';
    const season = Number(req.query.season) || new Date().getFullYear();
    const result = await fetchPercentiles(req.params.playerId, type, season);
    res.json(result); // { ok:true, ... } | { ok:false }
  });

  if (process.env.NODE_ENV === 'production') {
    const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
    app.use(express.static(dist));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  return app;
}

// Start the server only when run directly (not when imported by tests).
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const port = Number(process.env.PORT) || 8080;
  createApp().listen(port, () => console.log(`DiamondGPT server on :${port}`));
}
