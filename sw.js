const CACHE_NAME = 'gestor-v10-cache';
const assets = [
  './',
  './index.html',
  './formata.css',
  './scripts.js',
  './site.webmanifest',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Instala o Service Worker e guarda os arquivos no cache
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(assets))
  );
});

// Responde as requisições usando o cache quando offline
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});