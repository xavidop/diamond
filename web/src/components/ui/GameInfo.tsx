import { Card } from "./Primitives";

export default function GameInfo({ box, game }: { box: any; game: any }) {
  const info = (box?.info ?? []) as { label: string; value?: string }[];
  const officials = (box?.officials ?? []) as any[];
  const weather = game?.weather;
  const venue = game?.venue;
  const attendance = game?.gameInfo?.attendance;
  const firstPitch = game?.gameInfo?.firstPitch;
  const length = game?.gameInfo?.gameDurationMinutes;

  if (!info.length && !officials.length && !weather && !attendance)
    return null;

  return (
    <Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {weather && (
          <Block title="Weather">
            <Row k="Conditions" v={weather.condition} />
            <Row k="Temp" v={weather.temp ? `${weather.temp}°` : undefined} />
            <Row k="Wind" v={weather.wind} />
          </Block>
        )}
        <Block title="Game info">
          {venue && <Row k="Venue" v={venue.name} />}
          {attendance != null && (
            <Row k="Attendance" v={attendance.toLocaleString()} />
          )}
          {firstPitch && (
            <Row
              k="First pitch"
              v={new Date(firstPitch).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            />
          )}
          {length && <Row k="Length" v={`${length} min`} />}
        </Block>

        {officials.length > 0 && (
          <Block title="Umpires">
            {officials.map((o) => (
              <Row
                key={`${o.officialType}-${o.official?.id}`}
                k={o.officialType}
                v={o.official?.fullName}
              />
            ))}
          </Block>
        )}

        {info.length > 0 && (
          <Block title="Notes">
            {info.slice(0, 8).map((i, idx) => (
              <Row key={idx} k={i.label} v={i.value} />
            ))}
          </Block>
        )}
      </div>
    </Card>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-pitch-300/60 mb-1.5">
        {title}
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k?: string; v?: string }) {
  if (!v) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-pitch-300/80 text-xs uppercase tracking-wider truncate">
        {k}
      </span>
      <span className="text-white/70 text-right truncate">{v}</span>
    </div>
  );
}
