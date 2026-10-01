const CACHE_NAME = 'smart-waste-v3.0'; // เปลี่ยนเวอร์ชันเพื่อบังคับอัปเดต
const STATIC_ASSETS = [
    './', './index.html', './style.css', './script.js', './Logo.png', './manifest.json',
];

self.addEventListener('install', event => {
    // บังคับให้ Service Worker ตัวใหม่ทำงานทันที ไม่ต้องรอ
    self.skipWaiting(); 
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
    
    // พวก API ปล่อยผ่านไปเน็ตตลอด
    if (url.hostname.includes('firebase') || url.hostname.includes('groq') ||
        url.hostname.includes('gstatic') || url.hostname.includes('googleapis') ||
        url.hostname.includes('jsdelivr') || url.hostname.includes('flaticon') ||
        url.hostname.includes('placehold')) {
        event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
        return;
    }
    
    // NETWORK FIRST STRATEGY (ดึงจากเน็ตก่อน ถ้าพัง/ออฟไลน์ ค่อยดึงแคช)
    event.respondWith(
        fetch(event.request).then(res => {
            if (res.ok && event.request.method === 'GET') {
                const clone = res.clone();
                caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
            }
            return res;
        }).catch(() => {
            return caches.match(event.request);
        })
    );
});
