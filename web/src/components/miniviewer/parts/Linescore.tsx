import type { LineT } from "../../../lib/miniviewer";

/**
 * Inning-by-inning grid with R/H/E. Pads out to the scheduled inning count so a
 * game in the 3rd still shows a full-width grid, and grows past it for extras.
 * Wider than the window in extras, so it scrolls inside its own container.
 */
export default function Linescore({
  line,
  awayName,
  homeName,
  isFinal = false,
  compact = false,
}: {
  line: LineT;
  awayName: string;
  homeName: string;
  isFinal?: boolean;
  compact?: boolean;
}) {
  const played = line.innings.length;
  const columns = Math.max(line.scheduledInnings, played);
  const nums = Array.from({ length: columns }, (_, i) => i + 1);

  const cell = (num: number, side: "away" | "home") => {
    const inning = line.innings.find((i) => i.num === num);
    if (!inning) return <span className="text-white/25">·</span>;
    const runs = inning[side];
    if (runs != null) return runs;
    // A final game with an un-batted half means the home side never needed it.
    if (isFinal && side === "home") return "X";
    return <span className="text-white/25">·</span>;
  };

  const row = (side: "away" | "home", name: string) => (
    <tr>
      <td className="text-left font-display text-[13px] font-extrabold uppercase">{name}</td>
      {nums.map((n) => (
        <td key={n} className="px-[3px] text-center text-white/75">
          {cell(n, side)}
        </td>
      ))}
      <td data-testid="r" className="border-l border-white/10 px-[3px] text-center font-medium">
        {line[side].runs}
      </td>
      <td data-testid="h" className="px-[3px] text-center font-medium">{line[side].hits}</td>
      <td data-testid="e" className="px-[3px] text-center font-medium">{line[side].errors}</td>
    </tr>
  );

  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse font-mono ${compact ? "text-[10px]" : "text-[11px]"}`}>
        <thead>
          <tr className="text-[9.5px] font-normal text-white/30">
            <th />
            {nums.map((n) => (
              <th key={n} scope="col" className="px-[3px] font-normal">{n}</th>
            ))}
            <th scope="col" className="border-l border-white/10 px-[3px] font-normal">R</th>
            <th scope="col" className="px-[3px] font-normal">H</th>
            <th scope="col" className="px-[3px] font-normal">E</th>
          </tr>
        </thead>
        <tbody>
          {row("away", awayName)}
          {row("home", homeName)}
        </tbody>
      </table>
    </div>
  );
}
