self.addEventListener("install", (e) => {
    self.skipWaiting();
    console.log("Service Worker: installed");
});

self.addEventListener("activate", (e) => {
    clients.claim();
    console.log("Service Worker: active");
});

// Cache basique : toutes les ressources statiques
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return (
                cachedResponse ||
                fetch(event.request).then((networkResponse) => {
                    return networkResponse;
                })
            );
        })
    );
});
