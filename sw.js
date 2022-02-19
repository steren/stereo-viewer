const cacheVersion = 'v6';
const cacheName = 'stereo-viewer-' + cacheVersion;

const urlsToCache = [
  "/",
  "/icons/icon.svg",
  "https://cdn.jsdelivr.net/npm/webxr-polyfill@latest/build/webxr-polyfill.js",
  "https://cdn.skypack.dev/stereo-img@1.5.0",
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
// If POST is received, 
self.addEventListener('fetch', (event) => {

  if (event.request.method === 'POST') {
    event.respondWith((async () => {
      const formData = await event.request.formData();
      const files = formData.getAll('files');
      console.log('Received files from Share action:', files);
      // TODO: Send the files to the app.
      return Response.redirect('/', 303);
    })());
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      }),
    );
  }
});