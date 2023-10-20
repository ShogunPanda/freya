import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { type BaseLogger } from 'pino'

const cacheRoot = resolve(process.cwd(), 'tmp/cache')

export function cacheKey(keyContent: string | Buffer): string {
  const hash = createHash('sha1')
  hash.update(keyContent)
  return hash.digest().toString('hex')
}

export async function loadFromCache<T>(keyContent: string, logger?: BaseLogger): Promise<T | undefined> {
  const key = cacheKey(keyContent)
  const file = resolve(cacheRoot, key)

  if (!existsSync(file)) {
    return undefined
  }

  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    logger?.error({ error }, `Corrupted cache entry ${key}, ignoring it.`)

    return undefined
  }
}

export async function saveToCache(keyContent: string, content: unknown): Promise<void> {
  await mkdir(cacheRoot, { recursive: true })

  await writeFile(resolve(cacheRoot, cacheKey(keyContent)), JSON.stringify(content), 'utf8')
}
