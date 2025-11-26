import type { Pusher } from './slidesets/models.ts'
import { type BuildContext } from '@perseveranza-pets/dante'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function loadPusherSettings(): Pusher | undefined {
  const { PUSHER_KEY: key, PUSHER_SECRET: secret, PUSHER_CLUSTER: cluster } = process.env

  if (process.env.PUSHER_ENABLED !== 'true') {
    return undefined
  }

  if (!key || !secret || !cluster) {
    throw new Error(
      'In order to enable Pusher based synchronization, you also have to define PUSHER_KEY, PUSHER_SECRET and PUSHER_CLUSTER environment variables.'
    )
  }

  return { key, secret, cluster }
}

export function setWhitelistedTalks(list: string): void {
  let whitelisted
  if (process.env.FREYA_WHITELIST) {
    whitelisted = process.env.FREYA_WHITELIST
  } else {
    whitelisted = list
  }

  whitelistedTalks = (whitelisted ?? '')
    .split(/\s*,\s*/)
    .map(t => t.trim())
    .filter(t => t)
}

export function filterWhitelistedTalks(_context: BuildContext, talks: Set<string>): Set<string> {
  let whitelisted = [...talks]

  if (whitelistedTalks.length > 0) {
    whitelisted = whitelisted.filter(t => whitelistedTalks.includes(t))
  }

  return new Set(whitelisted)
}

export function isServiceWorkerEnabled(context: BuildContext): boolean {
  return (
    (process.env.FREYA_ENABLE_SERVICE_WORKER === 'true' || context.isProduction) && !context.extensions.freya.export
  )
}

export const freyaDir = resolve(fileURLToPath(import.meta.url), '../..')
export let whitelistedTalks: string[]
export const pusherConfig = loadPusherSettings()
setWhitelistedTalks('')
