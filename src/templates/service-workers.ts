/// <reference lib="webworker" />

import type { BuildContext } from '@perseveranza-pets/dante'

declare let self: ServiceWorkerGlobalScope

declare global {
  var workbox: any
  var debug: boolean
  var version: string
  var talk: string
  var images: string[]
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
  globalThis.importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js')

  const workbox = globalThis.workbox
  const rootUrl = self.origin
  const rootUrlHash = Array.from(new Uint8Array(new TextEncoder().encode(self.origin)))
    .map(i => i.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 8)
  const cacheId = `freya-${rootUrlHash}`
  const manifest = globalThis.images.map(s => ({ url: `${rootUrl}${s}`, revision: globalThis.version }))

  // General
  self.skipWaiting().catch(console.error)
  workbox.setConfig({ debug: globalThis.debug })
  workbox.core.clientsClaim()

  // Precaching
  workbox.core.setCacheNameDetails({ prefix: cacheId, suffix: '', precache: `precache-${talk}` })
  workbox.precaching.precacheAndRoute(manifest, { cleanUrls: true })
  workbox.precaching.cleanupOutdatedCaches()

  // Register all slide routes with SWR
  workbox.routing.registerRoute(
    new RegExp(`^/(?:${talk}})(/\\d{1,3})?`),
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

  // Notify when the cache has been updated
  self.addEventListener('activate', async () => {
    for (const client of await self.clients.matchAll({ type: 'window' })) {
      client.postMessage({ type: 'new-version-available', payload: { version: globalThis.version } })
    }
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

export function talkServiceWorkerDeclaration(context: BuildContext, talk: string, images: string[]): string {
  return `
${talkServiceWorker};

globalThis.debug = ${process.env.FREYA_ENABLE_SERVICE_WORKER === 'true' || !context.isProduction};
globalThis.version = "${context.version}";
globalThis.talk = "${talk}";
globalThis.images = ${JSON.stringify(images)};

talkServiceWorker();
  `
}
