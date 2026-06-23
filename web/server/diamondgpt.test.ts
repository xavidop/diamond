import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDERS, resolveKey } from './diamondgpt.ts';

test('PROVIDERS match the CLI (ids, models, env vars)', () => {
  assert.deepEqual(
    PROVIDERS.map((p) => [p.id, p.model, p.envVar]),
    [
      ['gemini', 'gemini-flash-latest', 'GEMINI_API_KEY'],
      ['anthropic', 'claude-sonnet-4-6', 'ANTHROPIC_API_KEY'],
      ['openai', 'gpt-4.1-mini', 'OPENAI_API_KEY'],
    ]
  );
});

test('resolveKey prefers the user key, then env, else null', () => {
  delete process.env.GEMINI_API_KEY;
  assert.equal(resolveKey('gemini', 'user-key'), 'user-key');
  assert.equal(resolveKey('gemini', ''), null);
  process.env.GEMINI_API_KEY = 'env-key';
  assert.equal(resolveKey('gemini', ''), 'env-key');
  assert.equal(resolveKey('gemini', 'user-key'), 'user-key');
  delete process.env.GEMINI_API_KEY;
});

test('resolveKey returns null for unknown provider', () => {
  assert.equal(resolveKey('nope', 'x'), 'x'); // user key still wins
  assert.equal(resolveKey('nope', ''), null);
});
