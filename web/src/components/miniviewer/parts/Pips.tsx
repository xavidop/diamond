/**
 * A row of count/out indicators. `kind="out"` renders red — and carries
 * `data-cb-bad`, because index.css remaps volt for colour-blind mode but not
 * danger, so red needs the explicit hook.
 */
export default function Pips({
  count,
  filled,
  kind,
  label,
  size = "md",
}: {
  count: number;
  filled: number;
  kind: "out" | "accent";
  label: string;
  size?: "sm" | "md";
}) {
  const dot = size === "sm" ? "h-[5px] w-[5px]" : "h-[7px] w-[7px]";
  return (
    <div className="flex items-center gap-[3px]" role="img" aria-label={label}>
      {Array.from({ length: count }, (_, i) => {
        const on = i < filled;
        return (
          <span
            key={i}
            data-pip={on ? "on" : "off"}
            {...(on && kind === "out" ? { "data-cb-bad": "" } : {})}
            className={`${dot} rounded-full ${
              on ? (kind === "out" ? "bg-danger-500" : "bg-volt-500") : "bg-white/10"
            }`}
          />
        );
      })}
    </div>
  );
}
