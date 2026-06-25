import type { NotifyEvent } from "./notifyDiff";

export function buildMessage(e: NotifyEvent): { title: string; body: string; tag: string } {
  const score = `${e.awayName} ${e.awayScore}, ${e.homeName} ${e.homeScore}`;
  switch (e.type) {
    case "run":
      return { title: "⚾ Run scored", body: score, tag: `${e.gamePk}:run` };
    case "final":
      return { title: "Final", body: score, tag: `${e.gamePk}:final` };
    case "starting":
      return {
        title: "▶ Game starting",
        body: `${e.awayName} @ ${e.homeName}`,
        tag: `${e.gamePk}:starting`,
      };
  }
}

export function fireNative(e: NotifyEvent): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const { title, body, tag } = buildMessage(e);
  const n = new Notification(title, { body, tag, icon: "/favicon.svg" });
  n.onclick = () => {
    window.focus();
    window.location.href = `/game/${e.gamePk}`;
  };
}
