import type { BasesT } from "../../../lib/miniviewer";

const ORDINALS: [keyof BasesT, string][] = [
  ["first", "1st"],
  ["second", "2nd"],
  ["third", "3rd"],
];

function describe(bases: BasesT): string {
  const on = ORDINALS.filter(([k]) => bases[k]).map(([, label]) => label);
  if (on.length === 0) return "Bases empty";
  if (on.length === 3) return "Bases loaded";
  if (on.length === 1) return `Runner on ${on[0]}`;
  return `Runners on ${on[0]} and ${on[1]}`;
}

export default function Diamond({
  bases,
  size = "md",
}: {
  bases: BasesT;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-3.5 w-3.5" : "h-[30px] w-[30px]";
  const pip = size === "sm" ? "h-[5px] w-[5px]" : "h-[9px] w-[9px]";
  const base = (on: boolean) =>
    `absolute ${pip} rotate-45 border ${
      on ? "border-volt-500 bg-volt-500 shadow-glow-volt" : "border-white/35"
    }`;
  const offset = size === "sm" ? "-2.5px" : "-4.5px";

  return (
    <div className={`relative ${box}`} role="img" aria-label={describe(bases)}>
      <span className={base(bases.second)} style={{ left: "50%", top: 0, marginLeft: offset }} />
      <span className={base(bases.third)} style={{ left: 0, top: "50%", marginTop: offset }} />
      <span className={base(bases.first)} style={{ right: 0, top: "50%", marginTop: offset }} />
    </div>
  );
}
