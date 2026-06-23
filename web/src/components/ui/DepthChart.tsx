import { Link } from "react-router-dom";
import { useMemo } from "react";
import { playerHeadshotUrl } from "../../api/mlb";
import { Card } from "./Primitives";

type Player = {
  person: { id: number; fullName: string };
  jerseyNumber?: string;
  position?: { abbreviation?: string; code?: string; type?: string };
  status?: { description?: string };
};

const POSITION_SLOTS: Record<string, { top: string; left: string }> = {
  C: { top: "85%", left: "50%" },
  "1B": { top: "62%", left: "73%" },
  "2B": { top: "48%", left: "62%" },
  SS: { top: "48%", left: "38%" },
  "3B": { top: "62%", left: "27%" },
  LF: { top: "20%", left: "20%" },
  CF: { top: "10%", left: "50%" },
  RF: { top: "20%", left: "80%" },
  DH: { top: "92%", left: "82%" },
  P: { top: "62%", left: "50%" },
};

const FIELD_ORDER = ["C", "1B", "2B", "SS", "3B", "LF", "CF", "RF", "DH"];

export default function DepthChart({ roster }: { roster: Player[] }) {
  const groups = useMemo(() => {
    const m: Record<string, Player[]> = {};
    for (const p of roster) {
      const pos = p.position?.abbreviation ?? "?";
      const key = pos === "P" ? (p.position?.type === "Pitcher" ? "P" : "?") : pos;
      (m[key] ??= []).push(p);
    }
    return m;
  }, [roster]);

  const pitchers = useMemo(
    () => roster.filter((p) => p.position?.type === "Pitcher"),
    [roster]
  );

  return (
    <div className="space-y-4">
      <Card>
        <div className="text-xs uppercase tracking-wider text-pitch-300/70 mb-3">
          Field positions
        </div>
        <div className="relative w-full aspect-square max-w-md mx-auto">
          <Diamond />
          {FIELD_ORDER.map((pos) => {
            const players = groups[pos] ?? [];
            const slot = POSITION_SLOTS[pos];
            if (!slot || players.length === 0) return null;
            return (
              <Slot
                key={pos}
                pos={pos}
                players={players}
                top={slot.top}
                left={slot.left}
              />
            );
          })}
          {groups.P && groups.P.length > 0 && (
            <Slot
              pos="P"
              players={groups.P}
              top={POSITION_SLOTS.P.top}
              left={POSITION_SLOTS.P.left}
            />
          )}
        </div>
      </Card>

      <PitcherPool pitchers={pitchers} />
    </div>
  );
}

function Diamond() {
  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
      <defs>
        <radialGradient id="dcGrass" cx="50%" cy="100%" r="120%">
          <stop offset="0%" stopColor="rgba(16,185,129,0.18)" />
          <stop offset="100%" stopColor="rgba(16,185,129,0.04)" />
        </radialGradient>
      </defs>
      <polygon
        points="100,180 30,30 100,5 170,30"
        fill="url(#dcGrass)"
        stroke="rgba(255,255,255,0.15)"
      />
      <path
        d="M 30 30 Q 100 -10 170 30"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={1}
      />
      <polygon
        points="100,180 60,130 100,90 140,130"
        fill="rgba(245,158,11,0.08)"
        stroke="rgba(245,158,11,0.4)"
      />
      <circle cx="100" cy="120" r="4" fill="rgba(245,158,11,0.5)" />
      <polygon
        points="92,180 108,180 108,188 100,193 92,188"
        fill="white"
        opacity="0.9"
      />
    </svg>
  );
}

function Slot({
  pos,
  players,
  top,
  left,
}: {
  pos: string;
  players: Player[];
  top: string;
  left: string;
}) {
  const starter = players[0];
  const backups = players.slice(1, 3);
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 group"
      style={{ top, left }}
    >
      <div className="flex flex-col items-center gap-0.5">
        <Link
          to={`/players/${starter.person.id}`}
          className="block relative"
          title={`${pos} · ${starter.person.fullName}`}
        >
          <img
            src={playerHeadshotUrl(starter.person.id, 90)}
            alt=""
            className="h-9 w-9 rounded-full object-cover bg-pitch-800 border-2 border-volt-500/80 shadow-card"
          />
          <span className="absolute -bottom-1 -right-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-pitch-700 px-1 text-[9px] font-bold text-white border border-pitch-900">
            {pos}
          </span>
        </Link>
        <div className="text-[10px] text-center text-white/70 truncate max-w-[80px]">
          {starter.person.fullName.split(" ").slice(-1)[0]}
        </div>
        {backups.length > 0 && (
          <div className="hidden group-hover:flex flex-col items-center mt-1 bg-pitch-950/95 rounded p-1 shadow-card z-10">
            {backups.map((b) => (
              <Link
                key={b.person.id}
                to={`/players/${b.person.id}`}
                className="text-[10px] text-pitch-300 hover:text-white whitespace-nowrap"
              >
                {b.person.fullName}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PitcherPool({ pitchers }: { pitchers: Player[] }) {
  const starters = pitchers.filter((p) =>
    /SP|Starting/i.test(p.position?.abbreviation ?? "")
  );
  // Most rosters use position.code "1" + abbreviation "P". Heuristic: first 5 are SP, rest RP.
  const list = starters.length > 0 ? { starters, rp: pitchers.filter((p) => !starters.includes(p)) } : { starters: pitchers.slice(0, 5), rp: pitchers.slice(5) };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <PitcherCard title="Starters" list={list.starters} />
      <PitcherCard title="Bullpen" list={list.rp} />
    </div>
  );
}

function PitcherCard({ title, list }: { title: string; list: Player[] }) {
  return (
    <Card pad={false}>
      <div className="px-4 py-2 border-b border-white/5 text-xs uppercase tracking-wider text-pitch-300/70 flex items-center justify-between">
        <span>{title}</span>
        <span className="font-mono">{list.length}</span>
      </div>
      <ul className="divide-y divide-white/5">
        {list.map((p) => (
          <li key={p.person.id}>
            <Link
              to={`/players/${p.person.id}`}
              className="flex items-center gap-3 px-4 py-2 hover:bg-white/5"
            >
              <img
                src={playerHeadshotUrl(p.person.id, 60)}
                alt=""
                className="h-7 w-7 rounded-full object-cover bg-pitch-800"
              />
              <span className="flex-1 truncate text-sm">
                {p.person.fullName}
              </span>
              <span className="text-[10px] text-pitch-300/60">
                #{p.jerseyNumber ?? "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
