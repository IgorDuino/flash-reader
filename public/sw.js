// Self-destructing service worker.
// Unregisters itself and clears all caches on install.
// This ensures any previously installed SW is cleaned up.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clear all caches
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))),
      // Unregister self
      self.registration.unregister(),
    ])
  );
});

// No fetch handler — pass everything through to the network
