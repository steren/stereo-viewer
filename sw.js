const cacheVersion = 'v18';
const cacheName = 'stereo-viewer-' + cacheVersion;

const cdnPrefix = 'https://cdn.skypack.dev/';

const urlsToCache = [
  "/",
  "/icons/icon.svg",
  "https://cdn.jsdelivr.net/npm/webxr-polyfill@latest/build/webxr-polyfill.js",
  cdnPrefix + "stereo-img@1.5.0",
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


self.addEventListener('fetch', (event) => {
  if (event.request.method === 'POST') {
    // Share actions send a POST requests, intercept it and redirect to / 
    event.respondWith((async () => {
      const formData = await event.request.formData();
      const files = formData.getAll('files');
      console.log('Received files from Share action:', files);
      // TODO: Send the files to the app.
      return Response.redirect('/', 303);
    })());
  } else {
    // Look for the request in the cache
    // If the request is in the cache, return it
    // Otherwise, fetch from the network and if .js file from CDN, store in cache
    event.respondWith(
      caches.open(cacheName).then((cache) => {
        return cache.match(event.request).then((response) => {
          return response || fetch(event.request).then((response) => {
            console.log(`Fetching from network: ${event.request.url}`);
            if (event.request.url.endsWith('.js') && event.request.url.startsWith(cdnPrefix)) { 
              console.log(`Caching ${event.request.url}`);
              cache.put(event.request, response.clone());
            }
            return response;
          });
        });
      })
    )
  }
});