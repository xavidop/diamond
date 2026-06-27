import { genkit } from 'genkit/beta';
import { InMemorySessionStore } from 'genkit/beta';
import { createHash } from 'node:crypto';
import { googleAI } from '@genkit-ai/google-genai';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { anthropic } from '@genkit-ai/anthropic';
import { defineTools } from './tools.ts';

export const PROVIDERS = [
  { id: 'gemini', label: 'Google Gemini', envVar: 'GEMINI_API_KEY', model: 'gemini-flash-latest' },
  { id: 'anthropic', label: 'Anthropic Claude', envVar: 'ANTHROPIC_API_KEY', model: 'claude-sonnet-4-6' },
  { id: 'openai', label: 'OpenAI', envVar: 'OPENAI_API_KEY', model: 'gpt-4.1-mini' },
] as const;

export function resolveKey(providerId: string, userKey?: string): string | null {
  if (userKey && userKey.trim()) return userKey.trim();
  const p = PROVIDERS.find((x) => x.id === providerId);
  if (!p) return null;
  const env = process.env[p.envVar];
  return env && env.trim() ? env.trim() : null;
}

function systemPrompt(): string {
  const now = new Date();
  const when = `Today is ${now.toDateString()} and the current MLB season is ${now.getFullYear()}. `;
  return (
    'You are DiamondGPT, a concise and friendly baseball expert living inside a web app. ' +
    when +
    'ALWAYS use the provided tools to fetch real data from the MLB Stats API — never invent scores, stats, standings, or transactions. ' +
    'To answer about a specific player, first call mlb_search_player to get the player ID, then mlb_player with that ID. ' +
    'Keep answers clear and well-structured; short Markdown is fine.'
  );
}

// One agent per (provider, key). Defined once and reused across requests so
// the agent's InMemorySessionStore retains conversations between turns.
type AgentEntry = ReturnType<typeof buildAgent>;
const agents = new Map<string, AgentEntry>();
const MAX_AGENTS = 50;

function buildAgent(providerId: string, key: string) {
  let ai;
  switch (providerId) {
    case 'gemini':
      ai = genkit({ plugins: [googleAI({ apiKey: key })], model: googleAI.model('gemini-flash-latest') });
      break;
    case 'openai':
      ai = genkit({ plugins: [openAI({ apiKey: key })], model: openAI.model('gpt-4.1-mini') });
      break;
    case 'anthropic':
      ai = genkit({ plugins: [anthropic({ apiKey: key })], model: anthropic.model('claude-sonnet-4-6') });
      break;
    default:
      throw new Error(`unknown provider "${providerId}"`);
  }
  const config = providerId === 'anthropic' ? { maxOutputTokens: 8192 } : undefined;
  return ai.defineAgent({
    name: 'diamondgpt',
    description: 'MLB-aware baseball assistant with live MLB Stats API tools.',
    system: systemPrompt(),
    tools: defineTools(ai),
    maxTurns: 6,
    store: new InMemorySessionStore(),
    ...(config ? { config } : {}),
  });
}

function getAgent(providerId: string, key: string) {
  const id = `${providerId}:${createHash('sha256').update(key).digest('hex').slice(0, 16)}`;
  let agent = agents.get(id);
  if (!agent) {
    agent = buildAgent(providerId, key);
    if (agents.size >= MAX_AGENTS) {
      const oldest = agents.keys().next().value;
      if (oldest) agents.delete(oldest);
    }
    agents.set(id, agent);
  }
  return agent;
}

export async function chat(
  providerId: string,
  key: string,
  sessionId: string | undefined,
  message: string,
): Promise<{ reply: string; sessionId?: string }> {
  const agent = getAgent(providerId, key);
  const conv = sessionId
    ? await agent.loadChat({ sessionId }).catch(() => agent.chat())
    : agent.chat();
  const resp = await conv.send(message);
  return { reply: resp.text, sessionId: resp.sessionId };
}
