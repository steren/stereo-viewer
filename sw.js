const cacheVersion = 'v24';
const cacheName = 'stereo-viewer-' + cacheVersion;

const stereoImgUrl = "https://stereo-img.steren.fr/stereo-img.js";

const urlsToCache = [
  "/",
  "/icons/icon.svg",
  "/icons/icon-transparent.svg",
  "https://cdn.jsdelivr.net/npm/webxr-polyfill@2.0.3/build/webxr-polyfill.js",
];

// Origins (other than our own) whose responses are cached for offline use.
const cachedOrigins = [
  new URL(stereoImgUrl).origin,
  "https://cdn.jsdelivr.net",
];

/**
 * Caches a JavaScript module and, recursively, every module it imports with a relative specifier.
 * <stereo-img> is made of many modules (three.js, exifr, parsers loaded on demand...):
 * they all need to be in the cache for the app to work offline.
 * This is best effort: a module that cannot be fetched is skipped.
 */
async function cacheModuleGraph(cache, url, seen = new Set()) {
  if (seen.has(url)) return;
  seen.add(url);
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    await cache.put(url, response.clone());
    const source = await response.text();
    const imports = source.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g);
    await Promise.all([...imports].map((match) => cacheModuleGraph(cache, new URL(match[1], url).href, seen)));
  } catch (e) {
    console.warn(`Could not cache ${url}`, e);
  }
}

// On install, cache critical offline resources.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(cacheName)
      .then((cache) => {
        console.log('Caching URLs');
        return Promise.all([
          cache.addAll(urlsToCache),
          cacheModuleGraph(cache, stereoImgUrl),
        ]);
      })
      // Replace any previous version right away: v23 and older fail to load the app.
      .then(() => self.skipWaiting())
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
    }).then(() => self.clients.claim()),
  );
});


self.addEventListener('fetch', async (event) => {
  if (event.request.method === 'POST') {
    // Share actions send a POST requests, intercept it and redirect to / 
    event.respondWith((async () => {
      const formData = await event.request.formData();
      const files = formData.getAll('files');
      console.log('Received files from Share action:', files);

      const allWindowsClients = await clients.matchAll();

      if(allWindowsClients.length > 0) {
        console.log("Found clients to send files");
        for (const client of allWindowsClients) {
          client.postMessage({
            files: files
          });
        }
      } else {
        console.error('No clients found to send files to');
      }
      
      return Response.redirect('/', 303);
    })());
  } else {
    // Network first: always serve the latest version when online,
    // and keep a copy in the cache to fall back to when offline.
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || (url.origin !== self.location.origin && !cachedOrigins.includes(url.origin))) {
      // Not ours to handle, let the browser do its thing.
      return;
    }

    event.respondWith(
      caches.open(cacheName).then(async (cache) => {
        try {
          const response = await fetch(event.request);
          if (response.status === 200) {
            event.waitUntil(cache.put(event.request, response.clone()));
          }
          return response;
        } catch (e) {
          const cached = await cache.match(event.request)
            // The app shell is cached as "/", whatever the query string
            || (event.request.mode === 'navigate' && await cache.match('/'));
          if (cached) {
            return cached;
          }
          throw e;
        }
      })
    )
  }
});