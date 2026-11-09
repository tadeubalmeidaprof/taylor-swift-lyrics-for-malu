// Service worker do Swifter Lyrics: guarda o próprio site no aparelho para
// que ele abra sem internet. As músicas offline ficam no localStorage, e as
// chamadas ao Supabase (outro domínio) nunca passam por aqui.

const CACHE_NAME = 'swifter-lyrics-shell-v1'
const NAVIGATION_TIMEOUT_MS = 3500
const SHELL_URLS =['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']

// Encontra os arquivos /assets/... citados no index.html gerado pelo Vite.
function assetUrlsFromHtml(html) {
  const urls = new Set()
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
    urls.add(match[1])
  }
  return [...urls]
}

// Salva o HTML mais recente e todos os arquivos que ele usa. Remove do cache
// os arquivos de versões antigas que o HTML novo não usa mais.
async function cacheShell(htmlResponse) {
  const cache = await caches.open(CACHE_NAME)
  const html = await htmlResponse.clone().text()
  const assets = assetUrlsFromHtml(html)

  if (assets.length === 0) return

  await cache.addAll(assets)
  await cache.put('/', htmlResponse.clone())

  const keep = new Set(assets)
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname
    if (path.startsWith('/assets/') && !keep.has(path)) {
      await cache.delete(request)
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(SHELL_URLS.filter((url) => url !== '/'))

    const response = await fetch('/', { cache: 'no-store' })
    if (response.ok) await cacheShell(response)

    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(
      names
        .filter((name) => name.startsWith('swifter-lyrics-shell-') && name !== CACHE_NAME)
        .map((name) => caches.delete(name)),
    )
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Páginas: tenta a rede primeiro (para receber versões novas) e usa a
  // cópia salva quando não há internet ou o sinal está fraco demais.
  if (request.mode === 'navigate') {
    const network = fetch(request, { cache: 'no-store' })
    event.waitUntil(
      network
        .then((response) => (response.ok ? cacheShell(response.clone()) : undefined))
        .catch(() => {}),
    )

    event.respondWith((async () => {
      // ignoreVary: o servidor pode responder com "Vary: Origin".
      const cached = await caches.match('/', { ignoreVary: true })
      if (!cached) return network

      const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NAVIGATION_TIMEOUT_MS))
      return Promise.race([network.catch(() => cached), timeout])
    })())
    return
  }

  // Arquivos do build têm hash no nome e nunca mudam: cache primeiro.
  if (url.pathname.startsWith('/assets/') || SHELL_URLS.includes(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(request, { ignoreVary: true })
      if (cached) return cached

      const response = await fetch(request)
      if (response.ok) {
        const copy = response.clone()
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {})
      }
      return response
    })())
  }
})
