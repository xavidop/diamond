// web/src/lib/registerSW.ts
// Registers the service worker in production builds so the app is installable
// as a PWA. Skipped during dev to avoid caching surprises with Vite HMR.

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration failures are non-fatal */
    });
  });
}
