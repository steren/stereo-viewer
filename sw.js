const cacheVersion = 'v23';
const cacheName = 'stereo-viewer-' + cacheVersion;

const urlsToCache = [
  "/",
  "/icons/icon.svg",
  "https://cdn.jsdelivr.net/npm/webxr-polyfill@latest/build/webxr-polyfill.js",
  "https://stereo-img.steren.fr/stereo-img.js",
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


// Files received from a Share action, waiting to be picked up by the page.
let sharedFiles = null;

// The page tells us when it is ready to receive the shared files.
self.addEventListener('message', (event) => {
  if (event.data === 'share-ready' && sharedFiles) {
    const files = sharedFiles;
    sharedFiles = null;
    event.waitUntil(files.then((files) => {
      console.log('Sending files from Share action:', files);
      event.source.postMessage({ files });
    }));
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method === 'POST') {
    // Share actions send a POST request: keep its files and redirect to /?shared.
    // The page loaded by this redirect does not exist yet, so we cannot send it the files now:
    // it asks for them with a 'share-ready' message once loaded.
    sharedFiles = event.request.formData().then((formData) => formData.getAll('files'));
    event.respondWith(Response.redirect('/?shared', 303));
    // Stay alive until the page has asked for the files (or give up after 30s).
    event.waitUntil(new Promise((resolve) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (!sharedFiles || Date.now() - start > 30000) {
          clearInterval(interval);
          resolve();
        }
      }, 500);
    }));
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