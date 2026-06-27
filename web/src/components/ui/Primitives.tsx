import { cn } from "../../lib/utils";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <div className={cn("card", pad && "card-pad", className)}>{children}</div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {subtitle && (
          <div className="page-eyebrow mb-1">{subtitle}</div>
        )}
        <h2 className="font-display font-black text-4xl sm:text-5xl uppercase leading-none text-white tracking-tight">
          {title}
        </h2>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white",
        className
      )}
    />
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 p-8 text-center font-display font-bold text-xs tracking-[0.12em] uppercase text-white/25">
      {message}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="rounded-xl border border-danger-600/40 bg-danger-600/10 p-4 text-sm text-red-100">
      <div className="font-display font-bold text-xs tracking-wider uppercase mb-1">
        Something went wrong
      </div>
      <div className="font-mono text-xs opacity-80 break-words">{msg}</div>
    </div>
  );
}
