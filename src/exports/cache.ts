import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'

interface CacheEntry {
  input: string
  artifact: string
}

interface CacheManifest {
  version: 2
  talks: Record<string, CacheEntry>
}

export async function hashExportFile(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk)
  }
  return hash.digest('hex')
}

async function hashTree(path: string, codeOnly: boolean = false): Promise<string> {
  let info
  try {
    info = await stat(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 'missing'
    }
    throw error
  }
  if (!info.isDirectory()) {
    return hashExportFile(path)
  }

  const hash = createHash('sha256')
  for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name, 'en')
  )) {
    // Original-image archives and speaker guides are not export inputs.
    if (
      entry.name.startsWith('.') ||
      entry.name.startsWith('__') ||
      entry.name === 'node_modules' ||
      ['summary.md', 'context.md'].includes(entry.name)
    ) {
      continue
    }
    if (codeOnly && !entry.isDirectory() && !['.ts', '.tsx', '.js', '.jsx', '.css'].includes(extname(entry.name))) {
      continue
    }
    hash.update(JSON.stringify([entry.name, await hashTree(join(path, entry.name), codeOnly)]))
  }
  return hash.digest('hex')
}

export class ExportCache {
  private readonly extension: 'pdf' | 'pptx'
  private readonly inputs: Map<string, string> = new Map()
  private readonly root: string
  private readonly output: string
  private readonly shared: string
  private readonly manifest: CacheManifest

  private constructor(
    root: string,
    output: string,
    shared: string,
    manifest: CacheManifest,
    extension: 'pdf' | 'pptx'
  ) {
    this.extension = extension
    this.root = root
    this.output = output
    this.shared = shared
    this.manifest = manifest
  }

  static async open(
    root: string,
    output: string,
    extension: 'pdf' | 'pptx',
    format: Record<string, unknown>
  ): Promise<ExportCache> {
    const hash = createHash('sha256')
    hash.update(JSON.stringify({ cacheVersion: 2, extension, ...format }))
    const sharedPaths = ['.env', 'src/talks/common.yml', 'src/themes', 'src/scripts']
    for (const path of sharedPaths) {
      hash.update(JSON.stringify([path, await hashTree(resolve(root, path))]))
    }
    // Talks can import CSS and components from other talks (for example the PPTX fixtures).
    hash.update(await hashTree(resolve(root, 'src/talks'), true))

    let manifest: CacheManifest = { version: 2, talks: {} }
    try {
      const parsed: unknown = JSON.parse(await readFile(resolve(output, 'cache.json'), 'utf8'))
      if (
        parsed &&
        typeof parsed === 'object' &&
        'version' in parsed &&
        parsed.version === 2 &&
        'talks' in parsed &&
        parsed.talks &&
        typeof parsed.talks === 'object' &&
        !Array.isArray(parsed.talks)
      ) {
        manifest = parsed as CacheManifest
      }
    } catch (error) {
      if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
    return new ExportCache(root, output, hash.digest('hex'), manifest, extension)
  }

  async matches(id: string): Promise<boolean> {
    const input = createHash('sha256')
      .update(this.shared)
      .update(await hashTree(resolve(this.root, 'src/talks', id)))
      .digest('hex')
    this.inputs.set(id, input)
    const entry = this.manifest.talks[id]
    if (!entry || entry.input !== input || typeof entry.artifact !== 'string') {
      return false
    }
    try {
      return (await hashExportFile(resolve(this.output, `${id}.${this.extension}`))) === entry.artifact
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false
      }
      throw error
    }
  }

  async record(id: string): Promise<void> {
    const input = this.inputs.get(id)
    if (!input) {
      throw new Error(`Export cache input fingerprint is missing for slideset "${id}".`)
    }
    this.manifest.talks[id] = { input, artifact: await hashExportFile(resolve(this.output, `${id}.${this.extension}`)) }
  }

  async save(staging: string): Promise<void> {
    // Publish the manifest only after successful artifact publication, on the same filesystem.
    const temporary = resolve(staging, 'cache.json')
    await writeFile(temporary, JSON.stringify(this.manifest, null, 2) + '\n', 'utf8')
    await rename(temporary, resolve(this.output, 'cache.json'))
  }
}
