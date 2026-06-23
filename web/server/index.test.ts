import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './index.ts';

async function start() {
  const app = createApp();
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const port = (server.address() as { port: number }).port;
  return { server, base: `http://127.0.0.1:${port}` };
}

test('GET /api/providers returns the three providers with hasServerKey flags', async () => {
  delete process.env.GEMINI_API_KEY;
  const { server, base } = await start();
  try {
    const res = await fetch(`${base}/api/providers`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.providers.length, 3);
    assert.deepEqual(body.providers.map((p: any) => p.id), ['gemini', 'anthropic', 'openai']);
    assert.equal(body.providers[0].hasServerKey, false);
  } finally {
    server.close();
  }
});

test('POST /api/chat 400s when no key is available', async () => {
  delete process.env.GEMINI_API_KEY;
  const { server, base } = await start();
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'gemini', message: 'hi' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /key/i);
  } finally {
    server.close();
  }
});

test('POST /api/chat 400s when message is missing', async () => {
  const { server, base } = await start();
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'gemini', apiKey: 'x' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /message/i);
  } finally {
    server.close();
  }
});
