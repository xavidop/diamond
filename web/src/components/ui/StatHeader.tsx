import type { ReactNode } from "react";
import { glossary } from "../../lib/glossary";

/**
 * <StatHeader name="ops">OPS</StatHeader>
 * Adds a dotted underline + native title tooltip when the term exists.
 */
export default function StatHeader({
  name,
  children,
}: {
  name: string;
  children?: ReactNode;
}) {
  const def = glossary(name);
  const label = children ?? name.toUpperCase();
  if (!def) return <>{label}</>;
  return (
    <abbr
      title={def}
      className="no-underline border-b border-dotted border-pitch-300/40 cursor-help"
    >
      {label}
    </abbr>
  );
}
