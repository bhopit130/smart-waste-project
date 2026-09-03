const CACHE_NAME = 'smart-waste-v2.0';
const STATIC_ASSETS = [
    './', './index.html', './style.css', './script.js', './Logo.png', './manifest.json',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            cache.addAll(STATIC_ASSETS).catch(err => console.warn('[SW] Cache warn:', err))
        ).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    // Always network-first for Firebase, Groq API, CDN
    if (url.hostname.includes('firebase') || url.hostname.includes('groq') ||
        url.hostname.includes('gstatic') || url.hostname.includes('googleapis') ||
        url.hostname.includes('jsdelivr') || url.hostname.includes('flaticon') ||
        url.hostname.includes('placehold')) {
        event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
        return;
    }
    // Cache-first for local assets
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(res => {
                if (res.ok && event.request.method === 'GET') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                }
                return res;
            }).catch(() => new Response('Offline', { status: 503 }));
        })
    );
});
