// 1. VERSIÓN DEL CACHÉ INCREMENTADA PARA FORZAR LA ACTUALIZACIÓN
const CACHE_NAME = 'dashsy-cache-v1.1.9.2';

// 2. MANTENEMOS TU LISTA DE ARCHIVOS ESENCIALES
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './assets/favicon.ico'
];

// 3. EVENTO DE INSTALACIÓN MEJORADO
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando nueva versión...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Archivos cacheados en la instalación.');
        return cache.addAll(URLS_TO_CACHE);
      })
      .then(() => self.skipWaiting()) // <-- MEJORA: Activa el nuevo SW más rápido
  );
});

// 4. MANTENEMOS TU LÓGICA PARA LIMPIAR CACHÉS ANTIGUAS
self.addEventListener('activate', event => {
  console.log('Service Worker: Activado y listo para controlar la app.');
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
    }).then(() => self.clients.claim()) // <-- MEJORA: Asegura el control inmediato
  );
});

// 5. REEMPLAZO CLAVE: LA NUEVA ESTRATEGIA DE CACHÉ
self.addEventListener('fetch', event => {
    // Excluimos las peticiones a Firebase para que siempre vayan a la red.
    if (event.request.url.includes('firestore.googleapis.com')) {
        return;
    }

    // Estrategia "Stale-While-Revalidate" CORREGIDA
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Iniciamos la petición a la red para actualizar la caché en segundo plano.
                const fetchPromise = fetch(event.request).then(
                    networkResponse => {
                        // Cuando la red responde, abrimos la caché.
                        caches.open(CACHE_NAME).then(cache => {
                            // Clonamos la respuesta: una para la caché, la original para el navegador.
                            cache.put(event.request, networkResponse.clone());
                        });
                        return networkResponse;
                    }
                );

                // Devolvemos la respuesta de la caché inmediatamente si la tenemos,
                // si no, esperamos a que la petición a la red termine.
                return cachedResponse || fetchPromise;
            })
    );
});

// 6. MANTENEMOS TU LÓGICA PARA EL BOTÓN DE "ACTUALIZAR"
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});


