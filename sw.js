// CUALQUIER CAMBIO QUE HAGAS A LOS ARCHIVOS DE LA APP, CAMBIA ESTE NÚMERO DE VERSIÓN
const CACHE_VERSION = 'v1.0.2'; // Sube a v1.0.3, v1.0.4, etc., en cada actualización

const CACHE_NAME = `dashsy-cache-${CACHE_VERSION}`;
// Lista de archivos que componen la "cáscara" de la aplicación
const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

// --- 1. Instalación del Service Worker ---
// Se activa cuando se encuentra un nuevo service worker.
self.addEventListener('install', event => {
    console.log(`[SW] Instalando versión: ${CACHE_VERSION}`);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Archivos de App Shell añadidos al caché.');
                return cache.addAll(urlsToCache);
            })
            .catch(err => {
                console.error('[SW] Error al añadir archivos al caché:', err);
            })
    );
});

// --- 2. Activación del Service Worker ---
// Se activa después de 'install' y se encarga de limpiar cachés antiguos.
self.addEventListener('activate', event => {
    console.log(`[SW] Activando versión: ${CACHE_VERSION}`);
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Si el nombre del caché no es el actual, se borra.
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Borrando caché antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Le dice al service worker que tome control de la página inmediatamente.
            return self.clients.claim();
        })
    );
});

// --- 3. Interceptación de Peticiones (Estrategia de Caché) ---
// Se activa cada vez que la app pide un recurso (una imagen, una página, etc.).
self.addEventListener('fetch', event => {
    event.respondWith(
        // Primero, busca el recurso en el caché.
        caches.match(event.request)
            .then(response => {
                // Si está en el caché, lo devuelve.
                if (response) {
                    return response;
                }
                // Si no, va a internet a buscarlo.
                return fetch(event.request);
            })
    );
});

// --- 4. Escucha de Mensajes para la Actualización ---
// Esta es la parte clave para la notificación de "Actualizar".
self.addEventListener('message', event => {
    // Si la app principal envía el mensaje 'SKIP_WAITING'...
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Recibido mensaje para saltar la espera. Activando nueva versión AHORA.');
        // ...el nuevo service worker se activa de inmediato, sin esperar a que se cierre la app.
        self.skipWaiting();
    }
});
