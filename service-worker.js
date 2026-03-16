/**
 * service-worker.js - Service Worker لدعم الـ PWA
 * يتيح العمل Offline وتخزين الموارد
 */

const CACHE_NAME = 'accounting-sys-v1.2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/accounts.js',
  '/js/transactions.js',
  '/js/statement.js',
  '/js/cashbox.js',
  '/js/reports.js',
  '/js/settings.js',
  '/js/app.js',
  '/manifest.json'
];

// ===== INSTALL =====
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ===== FETCH =====
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: Network First (لا نخزن بيانات API)
  if (url.href.includes('script.google.com') || url.href.includes('googleapis.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'غير متصل بالإنترنت' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Static Assets: Cache First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // تخزين المورد الجديد
        if (response && response.status === 200 && response.type !== 'opaque') {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cloned);
          });
        }
        return response;
      }).catch(() => {
        // Fallback للـ HTML الرئيسي
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ===== BACKGROUND SYNC (for offline queue) =====
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncPendingTransactions());
  }
});

async function syncPendingTransactions() {
  // سيتم التنفيذ عند استعادة الاتصال
  console.log('[SW] Syncing pending transactions...');
}

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'نظام المحاسبة', {
      body: data.body,
      icon: '/assets/icons/icon-192.png',
      badge: '/assets/icons/icon-192.png',
      dir: 'rtl',
      lang: 'ar'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
