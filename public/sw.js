const CACHE_NAME = '4dot-cache-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
];

const API_CACHE_NAME = '4dot-api-cache-v1';
const API_CACHEABLE = ['/api/leaderboard', '/api/active-games'];
const API_TTL = 30000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  const isApiCacheable = API_CACHEABLE.some(path => url.pathname.startsWith(path));
  if (isApiCacheable && event.request.method === 'GET') {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) {
          const cachedTime = cached.headers.get('sw-cache-time');
          if (cachedTime && Date.now() - parseInt(cachedTime) < API_TTL) {
            return cached;
          }
        }
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            const cloned = response.clone();
            const headers = new Headers(cloned.headers);
            headers.set('sw-cache-time', Date.now().toString());
            const body = await cloned.blob();
            cache.put(event.request, new Response(body, { headers }));
          }
          return response;
        } catch {
          if (cached) return cached;
          return new Response('{"error":"Offline"}', { status: 503, headers: { 'Content-Type': 'application/json' } });
        }
      })
    );
    return;
  }

  if (event.request.method !== 'GET') return;

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) return response;
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME, API_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
  self.clients.claim();
});
