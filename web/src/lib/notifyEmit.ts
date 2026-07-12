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
  const url = `/game/${e.gamePk}`;
  const options: NotificationOptions = {
    body,
    tag,
    icon: "/favicon.svg",
    badge: "/pwa-icon.svg",
    // Consumed by the service worker's `notificationclick` handler.
    data: { url, gamePk: e.gamePk },
  };

  // Prefer the service worker: it owns the click handling (works even after
  // this tab is gone) and is required to show notifications on some platforms
  // (e.g. Android Chrome, where `new Notification()` throws). Fall back to the
  // page-level constructor when no SW is registered (e.g. dev).
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (reg) return reg.showNotification(title, options);
        firePageNotification(title, options, url);
      })
      .catch(() => firePageNotification(title, options, url));
    return;
  }
  firePageNotification(title, options, url);
}

// firePageNotification shows a notification from the page context and wires its
// click to focus the tab and navigate to the game. Used when no service worker
// is available to show/handle it.
function firePageNotification(
  title: string,
  options: NotificationOptions,
  url: string
): void {
  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      // Hard nav (not SPA routing): a module-level handler has no router access.
      window.location.href = url;
    };
  } catch {
    /* Some browsers only allow SW-shown notifications; nothing else to do. */
  }
}
