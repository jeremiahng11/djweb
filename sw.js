// Service worker: makes the online build an installable, offline-capable PWA.
// NETWORK-FIRST for GET requests: when online you always get the latest (no stale-asset
// problems after a deploy); falls back to cache only when offline. Bump CACHE on each release.
var CACHE = "dj-v161";

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
    fetch(req)
      .then(function (resp) {
        if (resp && resp.ok && req.url.indexOf("http") === 0) {
          var clone = resp.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, clone); });
        }
        return resp;
      })
      .catch(function () {
        return caches.open(CACHE).then(function (cache) { return cache.match(req); });
      })
  );
});
