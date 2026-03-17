const CACHE_NAME = 'accounting-sys-v1.3';
const STATIC_ASSETS = [
  '/alaqsa/',
  '/alaqsa/index.html',
  '/alaqsa/offline.html',
  '/alaqsa/css/style.css',
  '/alaqsa/js/api.js',
  '/alaqsa/js/supabase.js',
  '/alaqsa/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/alaqsa/offline.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(c => c || fetch(e.request))
  );
});
