// 1. CAMBIA LA VERSIÓN DEL CACHÉ.
//    Cada vez que subas una nueva versión de tu app, deberás incrementar este número (v2, v3, etc.).
const CACHE_NAME = 'dashsy-cache-v1.1.1'; 

const urlsToCache = [
  './',
  './index.html', // Es mejor apuntar a 'index.html' que a un nombre de archivo específico
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto y archivos añadidos');
        // self.skipWaiting() aquí fuerza la activación inmediata,
        // pero es mejor controlarlo desde el cliente como ya lo haces.
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si la respuesta está en caché, la devuelve. Si no, la busca en la red.
        return response || fetch(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Si el nombre del caché no está en nuestra "lista blanca", se elimina.
          // Esto borra las versiones viejas del caché.
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 2. AÑADE ESTE CÓDIGO.
//    Este es el receptor del mensaje que tu app envía cuando el usuario
//    presiona el botón "Actualizar".
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});







