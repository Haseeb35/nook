// Nook service worker: the room works offline after the first visit.
//
// Strategy: stale-while-revalidate for everything same-origin. A request is
// answered from the cache at once (if present) while the network refreshes
// the copy for next time, so updates arrive on the following visit. Sound
// files are cached the first time they are played (only the format this
// browser uses). Bump VERSION to drop old caches on a release.

const VERSION = 'nook-v2';

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/tokens.css',
  'css/room.css',
  'css/ui.css',
  'js/early.js',
  'js/main.js',
  'js/room.js',
  'js/timer.js',
  'js/settings.js',
  'js/storage.js',
  'js/audio.js',
  'fonts/fraunces-var.woff2',
  'fonts/fraunces-var-italic.woff2',
  'fonts/jetbrains-mono-var.woff2',
  'icons/favicon.svg',
  'icons/icon-192.png',
];

// Nice to have offline, but the app must install without them.
const OPTIONAL = ['sounds/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    await Promise.all(OPTIONAL.map(url => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== VERSION).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    // Only the app's own address is the app. Other pages on the same site
    // (docs/room-preview.html, say) are cached as themselves.
    const scope = new URL(self.registration.scope).pathname;
    const isApp = request.mode === 'navigate' && (url.pathname === scope || url.pathname === `${scope}index.html`);
    // ?time=night and friends are the same page.
    const cached = await cache.match(isApp ? 'index.html' : request, { ignoreSearch: isApp });

    const network = fetch(request)
      .then(response => {
        if (response.ok && response.type === 'basic') {
          cache.put(isApp ? 'index.html' : request, response.clone());
        }
        return response;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    return (await network) ?? Response.error();
  })());
});

// A session-end notification brings the room back to the front.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find(client => new URL(client.url).pathname.startsWith(new URL(self.registration.scope).pathname));
    if (open) return open.focus();
    return self.clients.openWindow('./');
  })());
});
