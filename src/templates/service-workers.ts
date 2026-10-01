/// <reference lib="webworker" />

import type { BuildContext } from '@perseveranza-pets/dante'

declare let self: ServiceWorkerGlobalScope

declare global {
  var workbox: any
  var debug: boolean
  var version: string
  var talk: string
  var resources: string[]
}

function indexServiceWorker(): void {
  globalThis.importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js')

  const workbox = globalThis.workbox

  // General
  self.skipWaiting().catch(console.error)
  workbox.setConfig({ debug: globalThis.debug })
  workbox.core.clientsClaim()

  // Cache Google Fonts
  workbox.routing.registerRoute(
    /^(https:\/\/fonts\.gstatic\.com)/,
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'google-fonts',
      plugins: [new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })]
    })
  )

  // Notify when the cache has been updated
  self.addEventListener('activate', async () => {
    for (const client of await self.clients.matchAll({ type: 'window' })) {
      client.postMessage({ type: 'new-version-available', payload: { version: globalThis.version } })
    }
  })
}

function talkServiceWorker(): void {
  // Keep the talk worker self-contained so loading does not depend on the Workbox CDN.
  const cachePrefix = `freya-talk:${encodeURIComponent(globalThis.talk)}:`
  const cacheName = `${cachePrefix}${globalThis.version}`
  const urls = new Set(
    globalThis.resources
      .map(resource => new URL(resource, self.registration.scope))
      .filter(url => ['http:', 'https:'].includes(url.protocol))
      .map(url => url.href)
  )
  const subscribers = new Set<string>()
  const payload = {
    talk: globalThis.talk,
    version: globalThis.version,
    total: urls.size,
    processed: 0,
    downloaded: 0,
    cached: 0,
    failed: [] as string[]
  }
  let completed = false
  let preparation: Promise<void> | undefined

  async function notify(): Promise<void> {
    for (const id of subscribers) {
      const client = await self.clients.get(id)
      if (client) {
        client.postMessage({ type: completed ? 'completed' : 'progress', payload })
      } else {
        subscribers.delete(id)
      }
    }
  }

  async function prepare(): Promise<void> {
    const timer = setInterval(() => {
      notify().catch(console.error)
    }, 1000)

    try {
      const cache = await caches.open(cacheName)

      const queue = [...urls]
      const active = new Set<Promise<void>>()
      let next = 0

      async function prepareResource(url: string): Promise<void> {
        try {
          let response = await cache.match(url)

          if (response) {
            payload.cached++
          } else {
            response = await fetch(url, { signal: AbortSignal.timeout(30000), cache: 'reload' })

            if (!response.ok) {
              payload.failed.push(url)
              return
            }

            await cache.put(url, response.clone())
            payload.downloaded++
          }

          if (response.headers.get('content-type')?.includes('text/css')) {
            const css = await response.text()
            const references = css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)|@import\s+['"]([^'"]+)['"]/g)

            for (const match of references) {
              const dependency = new URL(match[1] ?? match[2], response.url || url)
              if (['http:', 'https:'].includes(dependency.protocol) && !urls.has(dependency.href)) {
                urls.add(dependency.href)
                queue.push(dependency.href)
              }
            }

            payload.total = urls.size
          }
        } catch (error) {
          payload.failed.push(url)
          console.error('Preloading resource failed.', url, error)
        } finally {
          payload.processed++
        }
      }

      // Keep four slots busy, including dependencies discovered by in-flight stylesheets.
      // Only finish when both the queue and all active resources have been drained.
      while (next < queue.length || active.size > 0) {
        while (next < queue.length && active.size < 4) {
          const task = prepareResource(queue[next++]).finally(() => {
            active.delete(task)
          })
          active.add(task)
        }

        await Promise.race(active)
      }
    } catch (error) {
      // Storage failures must not keep the presentation behind the loading screen.
      payload.failed = [...urls]
      payload.processed = payload.total
      console.error('Preparing talk cache failed.', error)
    } finally {
      clearInterval(timer)
      completed = true
      await notify()
    }
  }

  async function updatePage(request: Request): Promise<Response> {
    const response = await fetch(request)

    if (response.ok) {
      try {
        const cache = await caches.open(cacheName)
        await cache.put(request, response.clone())
      } catch (error) {
        console.error('Caching talk page failed.', error)
      }
    }

    return response
  }

  async function fetchResource(request: Request): Promise<Response> {
    let cache: Cache | undefined

    try {
      cache = await caches.open(cacheName)
      const response = await cache.match(request)
      if (response) {
        return response
      }
    } catch (error) {
      console.error('Reading talk cache failed.', error)
    }

    const response = await fetch(request)
    if (cache && (response.ok || response.type === 'opaque')) {
      try {
        await cache.put(request, response.clone())
      } catch (error) {
        console.error('Updating talk cache failed.', error)
      }
    }
    return response
  }

  async function activate(): Promise<void> {
    await self.clients.claim()

    // Delete only older versions belonging to this talk.
    const names = await caches.keys()
    await Promise.all(
      names.filter(name => name.startsWith(cachePrefix) && name !== cacheName).map(name => caches.delete(name))
    )

    for (const client of await self.clients.matchAll({ type: 'window' })) {
      if (client.url.startsWith(self.registration.scope)) {
        client.postMessage({ type: 'new-version-available', payload: { version: globalThis.version } })
      }
    }
  }

  async function notifyAndPrepare(): Promise<void> {
    await notify()

    // A restarted worker reconstructs progress from the versioned cache.
    preparation ??= prepare()
    await preparation
  }

  self.addEventListener('install', event => {
    event.waitUntil(self.skipWaiting())
  })

  self.addEventListener('activate', event => {
    event.waitUntil(activate())
  })

  self.addEventListener('message', event => {
    if (
      event.data?.type !== 'subscribe' ||
      event.data?.talk !== globalThis.talk ||
      !event.source ||
      !('id' in event.source)
    ) {
      return
    }

    subscribers.add(event.source.id)
    event.waitUntil(notifyAndPrepare())
  })

  self.addEventListener('fetch', event => {
    const request = event.request

    if (request.method === 'GET' && request.mode === 'navigate' && request.url.startsWith(self.registration.scope)) {
      // Preserve stale-while-revalidate navigation independently from resource preparation.
      const cached = caches
        .open(cacheName)
        .then(cache => cache.match(request))
        .catch(() => undefined)

      const update = updatePage(request)
      event.waitUntil(update)
      event.respondWith(cached.then(response => response ?? update))
      return
    }

    if (
      request.method !== 'GET' ||
      (!urls.has(request.url) && !['image', 'font', 'style'].includes(request.destination))
    ) {
      return
    }

    event.respondWith(fetchResource(request))
  })
}

function registerServiceWorker(path: string): void {
  if (navigator.serviceWorker) {
    // @ts-expect-error This is valid object
    const currentVersion = globalThis.__freyaSiteVersion

    navigator.serviceWorker.addEventListener('message', event => {
      const { type, payload } = event.data

      if (type === 'new-version-available' && payload.version !== currentVersion) {
        console.log(`New version available: ${payload.version} (current is ${currentVersion}). Reloading the page.`)
        location.reload()
      }
    })

    navigator.serviceWorker.register(path).catch(console.error)
  }
}

export function serviceWorkerRegistration(path: string): string {
  return `
${registerServiceWorker};
registerServiceWorker("${path}");
  `
}

export function indexServiceWorkerDeclaration(context: BuildContext): string {
  return `
${indexServiceWorker};

globalThis.debug = ${process.env.FREYA_ENABLE_SERVICE_WORKER === 'true' || !context.isProduction};
globalThis.version = "${context.version}";

indexServiceWorker();
  `
}

export function talkServiceWorkerDeclaration(context: BuildContext, talk: string, resources: string[]): string {
  return `
${talkServiceWorker};

globalThis.debug = ${process.env.FREYA_ENABLE_SERVICE_WORKER === 'true' || !context.isProduction};
globalThis.version = ${JSON.stringify(context.version)};
globalThis.talk = ${JSON.stringify(talk)};
globalThis.resources = ${JSON.stringify(resources)};

talkServiceWorker();
  `
}
