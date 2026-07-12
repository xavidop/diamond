// web/public/sw.js
// Minimal service worker: enables install-to-home-screen (PWA) and provides a
// lightweight offline fallback. It deliberately does NOT cache API or ESPN
// responses so data stays fresh; it only precaches the app shell and serves a
// cached shell when navigations fail offline.

const CACHE = "diamond-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/pwa-icon.svg", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only handle same-origin requests; let the network handle APIs/ESPN/fonts.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // App navigations: network-first, fall back to the cached shell offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/index.html").then((r) => r || caches.match("/")))
    );
    return;
  }

  // Static assets: cache-first, then network (and cache the result).
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});

// --- Notifications -------------------------------------------------------
// The app shows game notifications (run scored / game starting / final) via
// `registration.showNotification(...)` with `data.url` pointing at the game.
// The page can be closed by the time the user clicks, so the click is handled
// here in the service worker: focus an existing tab (navigating it to the
// game) or open a new window.

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  const target = new URL(url, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        // Reuse an open same-origin tab: focus it and route to the game.
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              /* navigation can fail on some browsers; focusing is enough */
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })()
  );
});

// Optional: display notifications delivered via Web Push (if a backend is ever
// added). Payload is JSON: { title, body, tag, url, icon }.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Diamond", body: event.data.text() };
  }
  const title = payload.title || "Diamond";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      tag: payload.tag,
      icon: payload.icon || "/pwa-icon.svg",
      badge: "/pwa-icon.svg",
      data: { url: payload.url || "/" },
    })
  );
});

