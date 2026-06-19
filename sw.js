// 1. VERSIÓN DEL CACHÉ
const CACHE_NAME = 'dashsy-cache-v1.2.0';

// 2. LISTA DE ARCHIVOS ESENCIALES
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './assets/favicon.ico'
];

// 3. EVENTO DE INSTALACIÓN
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Archivos cacheados.');
        return cache.addAll(URLS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// 4. EVENTO DE ACTIVACIÓN (LIMPIEZA DE CACHÉS ANTIGUAS)
self.addEventListener('activate', event => {
  console.log('Service Worker: Activado.');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Borrando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 5. EVENTO FETCH CORREGIDO PARA IGNORAR PETICIONES POST
self.addEventListener('fetch', event => {
    // Ignoramos todas las peticiones que no sean GET. La caché solo soporta GET.
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Aunque la condición anterior ya podría cubrir esto, es bueno mantenerlo
    // por si en el futuro Firebase usa GET para alguna API que no quieres cachear.
    if (event.request.url.includes('firestore.googleapis.com')) {
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                const fetchPromise = fetch(event.request).then(
                    networkResponse => {
                        return caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, networkResponse.clone());
                            return networkResponse;
                        });
                    }
                );
                return cachedResponse || fetchPromise;
            })
    );
});


// 6. EVENTO DE SINCRONIZACIÓN EN SEGUNDO PLANO (BACKGROUND SYNC)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-dashsy-ops') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'RETRY_QUEUED_OPS' }));
      })
    );
  }
});

// 7. EVENTO DE MENSAJE (PARA ACTUALIZACIÓN Y SINCRO)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});








