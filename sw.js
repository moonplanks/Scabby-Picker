
// Cache-first service worker with offline support
const CACHE = 'scab-picker-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.webmanifest',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/samples/sample1.png',
  '/assets/samples/sample2.png',
  '/assets/samples/sample3.png',
  '/assets/samples/sample4.png',
  '/assets/samples/sample5.png',
  '/assets/samples/sample6.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).catch(() => caches.match('/index.html')))
  );
});
