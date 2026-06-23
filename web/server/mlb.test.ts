import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUrl, MLB_BASE } from './mlb.ts';

test('buildUrl joins base + path and encodes params, skipping empty', () => {
  const url = buildUrl(MLB_BASE, '/schedule', { sportId: 1, date: '2026-06-23', hydrate: '' });
  assert.equal(
    url,
    'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-06-23'
  );
});

test('buildUrl handles path without leading slash', () => {
  const url = buildUrl(MLB_BASE, 'teams', { sportId: 1 });
  assert.equal(url, 'https://statsapi.mlb.com/api/v1/teams?sportId=1');
});
