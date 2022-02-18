const cacheVersion = 'v3';
const cacheName = 'stereo-viewer-' + cacheVersion;

const urlsToCache = [
  "/",
];

// On install, cache critical offline resources.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(cacheName)
      .then((cache) => {
        console.log('Caching URLs');
        return cache.addAll(urlsToCache);
      })
  );
});

// On activate, delete old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name != cacheName;
          })
          .map((name) => {
            return caches.delete(name);
          })
      );
    }),
  );
});

// On fetch, return cached resources if present, otherwise fetch from network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }),
  );
});
