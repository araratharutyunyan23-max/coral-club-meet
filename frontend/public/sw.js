/* Coral Club Meet — minimal service worker.
 *
 * Purpose: make the app installable ("Add to Home Screen") on Android/iOS and
 * give it a light offline shell. It is deliberately conservative — it never
 * touches the API or any cross-origin request (LiveKit media/websockets, Google
 * Fonts), so the live call path is completely unaffected.
 */
const CACHE = 'coral-meet-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  // Only handle our own origin; leave API + cross-origin (LiveKit, fonts) alone.
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api')) return

  // App shell navigations: network-first, fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req)
          const cache = await caches.open(CACHE)
          cache.put('/', fresh.clone())
          return fresh
        } catch {
          const cached = await caches.match('/')
          return cached || Response.error()
        }
      })(),
    )
    return
  }

  // Hashed build assets are immutable — cache-first is safe and fast.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req)
        if (cached) return cached
        const fresh = await fetch(req)
        const cache = await caches.open(CACHE)
        cache.put(req, fresh.clone())
        return fresh
      })(),
    )
    return
  }

  // Other same-origin GETs (icons, manifest): network, fall back to cache.
  event.respondWith(
    (async () => {
      try {
        return await fetch(req)
      } catch {
        return (await caches.match(req)) || Response.error()
      }
    })(),
  )
})
