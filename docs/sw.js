const CACHE_NAME = 'p1c-v3';

const APP_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './css/style.css',
  './js/api.js',
  './js/app.js',
  './js/articles.js',
  './js/config.js',
  './js/data.js',
  './js/icons.js',
  './js/nav.js',
  './js/screens/article.js',
  './js/screens/auth.js',
  './js/screens/contacts.js',
  './js/screens/created.js',
  './js/screens/home.js',
  './js/screens/materials.js',
  './js/screens/new-ticket.js',
  './js/screens/profile.js',
  './js/screens/ticket.js',
  './js/screens/tickets.js',
  './js/store.js',
  './js/ui.js',
  './js/utils.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isOwnFile = url.origin === self.location.origin;
  const isApi = url.pathname.includes('/api/');
  const isAdmin = url.pathname.includes('/admin/');

  if (event.request.method !== 'GET' || !isOwnFile || isApi || isAdmin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
