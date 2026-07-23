import { useCallback, useEffect, useRef, useState } from "react";
import { GripHorizontal } from "lucide-react";
import { readPanelGeom, writePanelGeom, type PanelGeom } from "../../lib/miniStorage";
import { clampGeom, DEFAULT_PANEL } from "../../lib/panelGeometry";

function viewport() {
  return { w: window.innerWidth, h: window.innerHeight };
}

export default function MiniPanel({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [geom, setGeom] = useState<PanelGeom>(() =>
    clampGeom(readPanelGeom() ?? DEFAULT_PANEL, viewport())
  );
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const resize = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const commit = useCallback((next: PanelGeom) => {
    const clamped = clampGeom(next, viewport());
    setGeom(clamped);
    writePanelGeom(clamped);
  }, []);

  // Keep the panel on screen when the window shrinks under it.
  useEffect(() => {
    const onResize = () => setGeom((g) => clampGeom(g, viewport()));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const startDrag = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    // x/y grow leftward/upward, so store the sum and subtract the live pointer.
    drag.current = { dx: e.clientX + geom.x, dy: e.clientY + geom.y };
  };

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resize.current = { x: e.clientX, y: e.clientY, w: geom.w, h: geom.h };
  };

  const onMove = (e: React.PointerEvent) => {
    if (drag.current) {
      setGeom((g) =>
        clampGeom(
          { ...g, x: drag.current!.dx - e.clientX, y: drag.current!.dy - e.clientY },
          viewport()
        )
      );
      return;
    }
    if (resize.current) {
      const r = resize.current;
      // The panel is anchored bottom-right, so dragging the top-left grip
      // outward grows it.
      setGeom((g) =>
        clampGeom({ ...g, w: r.w + (r.x - e.clientX), h: r.h + (r.y - e.clientY) }, viewport())
      );
    }
  };

  const endGesture = () => {
    if (drag.current || resize.current) {
      drag.current = null;
      resize.current = null;
      commit(geom);
    }
  };

  return (
    <div
      className="diamond-chrome fixed z-[60] flex flex-col overflow-hidden rounded-xl border border-white/15 bg-pitch-950 shadow-2xl"
      style={{ right: geom.x, bottom: geom.y, width: geom.w, height: geom.h }}
      onPointerMove={onMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
    >
      <div className="flex shrink-0 items-center bg-white/5 text-white/30">
        <button
          type="button"
          onPointerDown={startResize}
          aria-label="Resize mini viewer"
          title="Drag to resize"
          className="cursor-nwse-resize px-1.5 py-1 text-[10px]"
        >
          ⤡
        </button>
        <div
          onPointerDown={startDrag}
          className="flex flex-1 cursor-move items-center justify-center py-1"
          title="Drag to move"
        >
          <GripHorizontal size={14} />
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
      {/* onClose is also wired to the X button inside MiniScoreboard's header */}
      <span className="sr-only">
        <button onClick={onClose}>Close</button>
      </span>
    </div>
  );
}
