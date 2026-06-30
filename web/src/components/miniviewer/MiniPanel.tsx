import { useRef, useState } from "react";
import { GripHorizontal } from "lucide-react";

export default function MiniPanel({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 24, y: 24 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX + pos.x, dy: e.clientY + pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    // pos is measured from the bottom-right, so dragging right/down shrinks it.
    setPos({
      x: Math.max(0, drag.current.dx - e.clientX),
      y: Math.max(0, drag.current.dy - e.clientY),
    });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div
      className="diamond-chrome fixed z-[60] h-[460px] w-[340px] overflow-hidden rounded-xl border border-white/15 bg-pitch-950 shadow-2xl"
      style={{ right: pos.x, bottom: pos.y }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="flex cursor-move items-center justify-center bg-white/5 py-1 text-white/30"
        title="Drag to move"
      >
        <GripHorizontal size={14} />
      </div>
      <div className="h-[calc(460px-26px)]">{children}</div>
      {/* onClose is also wired to the X button inside MiniScoreboard's header */}
      <span className="sr-only">
        <button onClick={onClose}>Close</button>
      </span>
    </div>
  );
}
