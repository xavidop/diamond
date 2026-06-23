export type ChatRole = 'user' | 'model';
export type ChatMessage = { role: ChatRole; text: string };
export type ProviderInfo = { id: string; label: string; model: string; hasServerKey: boolean };

export async function fetchProviders(): Promise<ProviderInfo[]> {
  const res = await fetch('/api/providers');
  if (!res.ok) throw new Error(`providers ${res.status}`);
  const body = (await res.json()) as { providers: ProviderInfo[] };
  return body.providers;
}

export async function sendChat(args: {
  provider: string;
  apiKey?: string;
  history: ChatMessage[];
  message: string;
}): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || `chat ${res.status}`);
  return (body as { reply: string }).reply;
}
