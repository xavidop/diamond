import { useEffect, useRef, useState } from 'react';
import { Send, Settings, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  fetchProviders, sendChat, type ChatMessage, type ProviderInfo,
} from '../api/diamondgpt';

const KEY_LS = 'diamondgpt.apiKey';
const PROVIDER_LS = 'diamondgpt.provider';

export default function DiamondGptPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState(() => localStorage.getItem(PROVIDER_LS) || 'gemini');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY_LS) || '');
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchProviders().then(setProviders).catch(() => {}); }, []);
  useEffect(() => { localStorage.setItem(PROVIDER_LS, provider); }, [provider]);
  useEffect(() => { localStorage.setItem(KEY_LS, apiKey); }, [apiKey]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const current = providers.find((p) => p.id === provider);
  const needsKey = current ? !current.hasServerKey : true;

  async function onSend() {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    const history = messages;
    setMessages([...history, { role: 'user', text }]);
    setInput('');
    setBusy(true);
    try {
      const reply = await sendChat({ provider, apiKey: apiKey || undefined, history, message: text });
      setMessages((m) => [...m, { role: 'model', text: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMessages((m) => [...m, { role: 'model', text: '⚠️ ' + (e instanceof Error ? e.message : String(e)) }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-volt-500">
            <Sparkles size={16} className="text-black" />
          </div>
          <div>
            <h1 className="font-display font-black text-lg uppercase tracking-widest text-white leading-none">DiamondGPT</h1>
            <p className="text-white/30 text-[11px] font-display font-bold uppercase tracking-wider mt-0.5">
              {current?.label ?? '—'} · live MLB data
            </p>
          </div>
        </div>
        <button onClick={() => setShowSettings((v) => !v)} className="btn p-2" title="Settings">
          <Settings size={14} />
        </button>
      </div>

      {showSettings && (
        <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
          <label className="block">
            <span className="text-white/40 text-[10px] font-display font-bold uppercase tracking-widest">Provider</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="mt-1 w-full rounded-lg bg-pitch-950 border border-white/10 px-3 py-2 text-sm text-white"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.label} ({p.model})</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-white/40 text-[10px] font-display font-bold uppercase tracking-widest">
              API Key {needsKey ? '' : '(optional — server has one)'}
            </span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={needsKey ? 'Paste your provider API key' : 'Leave blank to use the server key'}
              className="mt-1 w-full rounded-lg bg-pitch-950 border border-white/10 px-3 py-2 text-sm text-white"
            />
          </label>
          <p className="text-white/25 text-[11px]">Disclaimer: your API key is never stored on the server and is not used for any other purpose — it is used only to make this Diamond GPT request on your behalf.</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-white/30 text-sm">
              Ask about scores, standings, players, or stats — DiamondGPT pulls live MLB data.
            </div>
            <div className="text-white/20 text-[11px] mt-3 max-w-md mx-auto">
              Disclaimer: your API key is never stored on the server and is not used for any other purpose — only to make your DiamondGPT requests.
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            {m.role === 'user' ? (
              <div className="inline-block max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap bg-volt-500 text-black">
                {m.text}
              </div>
            ) : (
              <div className="inline-block max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-white/[0.06] text-left
                prose prose-sm prose-invert max-w-none
                prose-p:my-2 prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:font-display prose-headings:uppercase prose-headings:tracking-wide
                prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
                prose-strong:text-white prose-a:text-volt-500
                prose-table:text-xs prose-th:text-left prose-hr:border-white/10
                prose-code:text-volt-500 prose-code:before:content-none prose-code:after:content-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}
        {busy && <div className="text-white/30 text-sm">DiamondGPT is thinking…</div>}
        <div ref={endRef} />
      </div>

      {error && <div className="text-red-400 text-xs mt-2">{error}</div>}

      <div className="mt-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
          placeholder="Ask DiamondGPT…"
          className="flex-1 rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25"
        />
        <button onClick={onSend} disabled={busy} className="btn p-3 disabled:opacity-40" title="Send">
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
