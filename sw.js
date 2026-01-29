const CACHE_NAME = 'courses-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

// 1. INSTALL: Mise en cache des ressources statiques
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// 2. ACTIVATE: Nettoyage des vieux caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// 3. FETCH: Stratégie "Cache First, falling back to Network" pour l'App Shell
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).catch(() => {
                // Fallback optionnel si besoin
            });
        })
    );
});

// 4. BACKGROUND SYNC
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-list') {
        event.waitUntil(syncData());
    }
});

// Simulation d'un envoi au serveur (vu qu'on est sans backend)
// et déclenchement d'une notification
function syncData() {
    return new Promise((resolve) => {
        // Ici, on ferait normalement un fetch(POST) vers le serveur
        setTimeout(() => {
            console.log('Synchronisation terminée en arrière-plan');
            
            // Notification bonus
            if (self.registration.showNotification) {
                self.registration.showNotification("Liste synchronisée", {
                    body: "Vos modifications ont été sauvegardées (simulé).",
                    icon: "https://via.placeholder.com/192/4CAF50/FFFFFF?text=OK"
                });
            }
            resolve();
        }, 1000);
    });
}