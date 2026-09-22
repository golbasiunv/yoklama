const CACHE_NAME = 'golbasi-yoklama-v4';
const APP_SHELL = [
    './',
    './index.html',
    './styles.css?v=4',
    './script.js?v=4',
    './manifest.json?v=4',
    './icons/icon-192x192.png?v=4',
    './icons/icon-512x512.png?v=4'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys
                .filter(key => key.startsWith('golbasi-yoklama-') && key !== CACHE_NAME)
                .map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;

    event.respondWith(
        fetch(request).then(response => {
            if (response.ok) {
                const copy = response.clone();
                event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
            }
            return response;
        }).catch(async () => {
            const cached = await caches.match(request);
            if (cached) return cached;
            if (request.mode === 'navigate') {
                return caches.match(new URL('./index.html', self.registration.scope));
            }
            return Response.error();
        })
    );
});
