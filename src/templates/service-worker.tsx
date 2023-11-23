// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference lib="webworker" />

import { type BuildContext } from 'dante'

declare let self: ServiceWorkerGlobalScope

declare global {
  // eslint-disable-next-line no-var
  var workbox: any
  // eslint-disable-next-line no-var
  var precache: string[]
  // eslint-disable-next-line no-var
  var talks: string[]
  // eslint-disable-next-line no-var
  var debug: boolean
  // eslint-disable-next-line no-var
  var version: string
}

function main(): void {
  globalThis.importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js')

  const rootUrl = self.origin
  const rootUrlHash = Array.from(new Uint8Array(new TextEncoder().encode(self.origin)))
    .map(i => i.toString(16).padStart(2, '0'))
    .join('')
  const cacheId = `freya-slides-${rootUrlHash}`

  const workbox = globalThis.workbox
  const manifest = globalThis.precache.map(s => ({ url: `${rootUrl}${s}`, revision: globalThis.version }))

  workbox.setConfig({ debug: globalThis.debug })

  // General
  self.skipWaiting().catch(console.error)
  workbox.core.clientsClaim()
  workbox.core.setCacheNameDetails({ prefix: cacheId, suffix: '', precache: 'precache' })

  // Precaching
  workbox.precaching.precacheAndRoute(manifest, { cleanUrls: true })
  workbox.precaching.cleanupOutdatedCaches()

  // Register all routes with SWR
  workbox.routing.registerRoute(
    new RegExp(`^/(?:${globalThis.talks.join('|')})(/\\d{1,2})?`),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'pages',
      plugins: [new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })]
    })
  )

  // Cache Google Fonts
  workbox.routing.registerRoute(
    /^(https:\/\/fonts\.gstatic\.com)/,
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'google-fonts',
      plugins: [new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })]
    })
  )

  // Application assets
  workbox.routing.registerRoute(
    /\/images\/(?:.*\/)?.*\.(?:png|svg|webp)/,
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'assets',
      plugins: [new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })]
    })
  )

  workbox.routing.registerRoute(
    /\/fonts\/(?:.*\/)?.*\.woff2/,
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'assets',
      plugins: [new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })]
    })
  )

  workbox.routing.registerRoute(
    /.+\.(?:js|mjs|json)$/,
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'data',
      plugins: [new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })]
    })
  )

  // Notify when the cache has been updated
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  self.addEventListener('activate', async () => {
    for (const client of await self.clients.matchAll({ type: 'window' })) {
      client.postMessage({ type: 'new-version-available', payload: { version: globalThis.version } })
    }
  })
}

export function serviceWorker(context: BuildContext, precache: string[]): string {
  return `
${main};

globalThis.debug = ${process.env.FREYA_ENABLE_SERVICE_WORKER === 'true' || !context.isProduction};
globalThis.version = "${context.version}";
globalThis.precache = ${JSON.stringify(precache)};
globalThis.talks = ${JSON.stringify(Array.from(context.extensions.talks))};

main()
`
}
