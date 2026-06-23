import { useState } from "react";
import { cn } from "../../lib/utils";
import { Check, Copy } from "lucide-react";

export function JsonView({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(data, null, 2);

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <div className="relative">
      <button
        onClick={copy}
        className={cn(
          "absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-md",
          "border border-white/10 bg-pitch-900/80 px-2 py-1 text-xs",
          "hover:bg-pitch-800 transition-colors"
        )}
        title="Copy JSON"
      >
        {copied ? (
          <>
            <Check size={12} /> Copied
          </>
        ) : (
          <>
            <Copy size={12} /> Copy
          </>
        )}
      </button>
      <pre className="max-h-[600px] overflow-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs font-mono leading-relaxed">
        <code>{syntaxHighlight(text)}</code>
      </pre>
    </div>
  );
}

function syntaxHighlight(json: string) {
  // Simple regex-based JSON syntax highlighting -> JSX
  const tokens: { text: string; cls: string }[] = [];
  const regex =
    /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(json)) !== null) {
    if (m.index > lastIndex)
      tokens.push({ text: json.slice(lastIndex, m.index), cls: "" });
    let cls = "text-orange-300";
    if (m[1]) cls = "text-sky-300";
    else if (m[2]) cls = "text-emerald-300";
    else if (m[3]) cls = "text-fuchsia-300";
    tokens.push({ text: m[0], cls });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < json.length)
    tokens.push({ text: json.slice(lastIndex), cls: "" });
  return tokens.map((t, i) =>
    t.cls ? (
      <span key={i} className={t.cls}>
        {t.text}
      </span>
    ) : (
      <span key={i}>{t.text}</span>
    )
  );
}
