self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister().then(() =>
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        for (const client of clients) client.navigate(client.url)
      }),
    ),
  )
})
