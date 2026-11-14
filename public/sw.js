// Quran Journey — Offline PWA Service Worker (Cache v1)
const STATIC_CACHE = "quran-journey-static-v1";
const OFFLINE_DATA_CACHE = "quran-journey-offline-data-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(["/manifest.webmanifest"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== OFFLINE_DATA_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept auth or state-mutating API calls
  if (url.pathname.startsWith("/api/auth")) return;

  // Offline-downloaded Mushaf pages and CDN audio assets: cache-first when present
  if (
    url.pathname.startsWith("/api/mushaf/offline") ||
    url.hostname === "audio.qurancdn.com" ||
    url.hostname === "verses.quran.foundation" ||
    url.hostname === "mirrors.quranicaudio.com"
  ) {
    event.respondWith(
      caches.open(OFFLINE_DATA_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          return fresh;
        } catch (err) {
          if (cached) return cached;
          throw err;
        }
      })
    );
    return;
  }

  // Same-origin Next.js static assets & pages: network-first with cache fallback
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/_next/static/")) {
      event.respondWith(
        caches.open(STATIC_CACHE).then(async (cache) => {
          const cached = await cache.match(request);
          if (cached) return cached;
          const fresh = await fetch(request);
          if (fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        })
      );
      return;
    }

    if (request.mode === "navigate") {
      event.respondWith(
        fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
          .catch(async () => {
            const cached = await caches.match(request);
            if (cached) return cached;
            const home = await caches.match("/");
            if (home) return home;
            return new Response(
              "<!doctype html><html lang='tr'><body style='font-family:sans-serif;padding:24px;background:#faf8f3;color:#1c241f'><h2>Çevrimdışı Moddasınız</h2><p>İnternet bağlantısı geri geldiğinde sayfayı yenileyebilir veya daha önce indirdiğiniz Mushaf sayfalarını açabilirsiniz.</p></body></html>",
              { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
            );
          })
      );
    }
  }
});
