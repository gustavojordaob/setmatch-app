/**
 * Service worker mínimo — necessário para o Chrome oferecer "Instalar app".
 * Sem cache agressivo: sempre rede (evita app travado em versão antiga).
 */
const CACHE_BUST = "setmatch-pwa-v1-20260807";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.postMessage({ type: "SETMATCH_SW_ACTIVATED", version: CACHE_BUST });
      }
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  event.respondWith(fetch(req, { cache: "no-store" }).catch(() => fetch(req)));
});
