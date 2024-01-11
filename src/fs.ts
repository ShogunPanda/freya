import { readFile as systemReadFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const contentsLRU: Record<string, string | undefined> = {}

export async function readFile(path: string | URL): Promise<string> {
  if (typeof path !== 'string') {
    path = fileURLToPath(path)
  }

  if (typeof contentsLRU[path] === 'undefined') {
    contentsLRU[path] = await systemReadFile(path, 'utf-8')
  }

  return contentsLRU[path]!
}

export function clearCachedFile(path: string | URL): void {
  if (typeof path !== 'string') {
    path = fileURLToPath(path)
  }

  contentsLRU[path] = undefined
}
