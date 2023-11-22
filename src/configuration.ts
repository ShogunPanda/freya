import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface Pusher {
  key: string
  secret: string
  cluster: string
}

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

export function filterWhitelistedTalks(talks: Set<string>): Set<string> {
  if (whitelistedTalks.length === 0) {
    return talks
  }
  return new Set([...talks].filter(t => whitelistedTalks.includes(t)))
}

export const freyaDir = resolve(fileURLToPath(import.meta.url), '../..')
export let whitelistedTalks: string[]
export const pusherConfig = loadPusherSettings()
setWhitelistedTalks('')
