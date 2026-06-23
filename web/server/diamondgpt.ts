import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { anthropic } from '@genkit-ai/anthropic';
import { defineTools } from './tools.ts';

export type ChatMessage = { role: 'user' | 'model'; text: string };

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

// Build a Genkit instance for the chosen provider, keyed with `apiKey`.
function initGenkit(providerId: string, apiKey: string) {
  switch (providerId) {
    case 'gemini':
      return genkit({ plugins: [googleAI({ apiKey })], model: googleAI.model('gemini-flash-latest') });
    case 'openai':
      return genkit({ plugins: [openAI({ apiKey })], model: openAI.model('gpt-4.1-mini') });
    case 'anthropic':
      return genkit({ plugins: [anthropic({ apiKey })], model: anthropic.model('claude-sonnet-4-6') });
    default:
      throw new Error(`unknown provider "${providerId}"`);
  }
}

export async function ask(
  providerId: string,
  apiKey: string,
  history: ChatMessage[],
  message: string
): Promise<string> {
  const ai = initGenkit(providerId, apiKey);
  const tools = defineTools(ai);
  const messages = history.map((m) => ({ role: m.role, content: [{ text: m.text }] }));
  // Anthropic's API requires max_tokens on every request.
  const config = providerId === 'anthropic' ? { maxOutputTokens: 8192 } : undefined;

  const resp = await ai.generate({
    system: systemPrompt(),
    messages,
    prompt: message,
    tools,
    maxTurns: 6,
    ...(config ? { config } : {}),
  });
  return resp.text;
}
