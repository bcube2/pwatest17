// COI Service Worker Integration
/*! coi-serviceworker v0.1.6 - Guido Zuidhof, licensed under MIT */
let coepCredentialless = false;

// Cache name and files from sw.js
const cacheName = 'Solver_v32';
const filesToCache = [
  'readfiles.js',
  'solve.html',
  'solver_help.html',
  'solve.js',
  'rclib.js',
  'rch.js',
  'verify.js',
  'AnimCube3.js',
  'AnimCube.txt',
  'search.js',
  'search_d3a.js',
  'search_d3b.js',
  'search_d4.js',
  'search_d411.js',
  'search_d422.js',
  'search_d434.js',
  'style2.css',
  'style.css',
  'dist5.js'
];

if (typeof window === 'undefined') {
  // Installation event from both service workers
  self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install');
    self.skipWaiting();
    event.waitUntil(
      caches.open(cacheName).then((cache) => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(filesToCache);
      })
    );
  });

  // Activation event from both service workers
  self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate');
    event.waitUntil(
      caches.keys().then((keyList) => {
        return Promise.all(
          keyList.map((key) => {
            if (key !== cacheName) {
              console.log('[ServiceWorker] Removing old cache', key);
              return caches.delete(key);
            }
          })
        );
      })
    );
    event.waitUntil(self.clients.claim());
  });

  // Message event from coi-serviceworker.js
  self.addEventListener('message', (ev) => {
    if (!ev.data) {
      return;
    } else if (ev.data.type === 'deregister') {
      self.registration
        .unregister()
        .then(() => self.clients.matchAll())
        .then((clients) => {
          clients.forEach((client) => client.navigate(client.url));
        });
    } else if (ev.data.type === 'coepCredentialless') {
      coepCredentialless = ev.data.value;
    }
  });

  // Fetch event handling both caching and COOP/COEP logic
  self.addEventListener('fetch', (event) => {
    console.log('[ServiceWorker] Fetch', event.request.url);

    const request = coepCredentialless && event.request.mode === 'no-cors'
      ? new Request(event.request, { credentials: 'omit' })
      : event.request;

    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then((response) => {
        if (response) {
          // Apply COOP/COEP headers to cached response
          const newHeaders = new Headers(response.headers);
          newHeaders.set(
            'Cross-Origin-Embedder-Policy',
            coepCredentialless ? 'credentialless' : 'require-corp'
          );
          newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        }

        // Fetch from the network if not in cache and apply COOP/COEP headers
        return fetch(request).then((networkResponse) => {
          if (networkResponse.status === 0) {
            return networkResponse;
          }

          const newHeaders = new Headers(networkResponse.headers);
          newHeaders.set(
            'Cross-Origin-Embedder-Policy',
            coepCredentialless ? 'credentialless' : 'require-corp'
          );
          newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

          return new Response(networkResponse.body, {
            status: networkResponse.status,
            statusText: networkResponse.statusText,
            headers: newHeaders,
          });
        });
      })
    );
  });
} else {
  // Client-side COI script initialization from coi-serviceworker.js
  (() => {
    const coi = {
      shouldRegister: () => true,
      shouldDeregister: () => false,
      coepCredentialless: () => false,
      doReload: () => window.location.reload(),
      quiet: false,
      ...window.coi,
    };

    const n = navigator;

    if (n.serviceWorker && n.serviceWorker.controller) {
      n.serviceWorker.controller.postMessage({
        type: 'coepCredentialless',
        value: coi.coepCredentialless(),
      });

      if (coi.shouldDeregister()) {
        n.serviceWorker.controller.postMessage({ type: 'deregister' });
      }
    }

    if (window.crossOriginIsolated !== false || !coi.shouldRegister()) return;

    if (!window.isSecureContext) {
      !coi.quiet &&
        console.log(
          'COOP/COEP Service Worker not registered, a secure context is required.'
        );
      return;
    }

    if (n.serviceWorker) {
      n.serviceWorker
        .register(window.document.currentScript.src)
        .then(
          (registration) => {
            !coi.quiet &&
              console.log(
                'COOP/COEP Service Worker registered',
                registration.scope
              );

            registration.addEventListener('updatefound', () => {
              !coi.quiet &&
                console.log(
                  'Reloading page to make use of updated COOP/COEP Service Worker.'
                );
              coi.doReload();
            });

            if (registration.active && !n.serviceWorker.controller) {
              !coi.quiet &&
                console.log(
                  'Reloading page to make use of COOP/COEP Service Worker.'
                );
              coi.doReload();
            }
          },
          (err) => {
            !coi.quiet &&
              console.error('COOP/COEP Service Worker failed to register:', err);
          }
        );
    }
  })();
}
