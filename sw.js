// Service worker: makes the online build an installable, offline-capable PWA.
// Runtime cache-first for GET requests (the game is static), so after the first
// load it works offline and starts fast. Bump CACHE on each release to refresh.
var CACHE = "dj-v147";

self.addEventListener("install", function (e) { self.skipWaiting(); });

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (resp) {
          if (resp && resp.ok && (req.url.indexOf("http") === 0)) cache.put(req, resp.clone());
          return resp;
        }).catch(function () { return hit; });
      });
    })
  );
});
