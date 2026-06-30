import { createPortal } from "react-dom";
import { useMiniViewer } from "../../contexts/MiniViewerContext";
import MiniScoreboard from "./MiniScoreboard";
import MiniPanel from "./MiniPanel";

export default function MiniViewer() {
  const { open, pipWindow, usePanel, closeMini } = useMiniViewer();

  if (!open) return null;
  if (pipWindow) {
    return createPortal(<MiniScoreboard />, pipWindow.document.body);
  }
  if (usePanel) {
    return (
      <MiniPanel onClose={closeMini}>
        <MiniScoreboard />
      </MiniPanel>
    );
  }
  return null; // PiP window is opening
}
