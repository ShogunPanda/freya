import type { ImagesResolver } from '../components/contexts.tsx'
import type { ClientContext, Config, ParsedSVG, Slide, Talk, Theme } from './models.ts'
import { existsSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { rootDir } from '@perseveranza-pets/dante'
import { glob } from 'glob'
import { load, loadAll } from 'js-yaml'
import { pusherConfig } from '../configuration.ts'
import { readFile } from '../fs.ts'

let commonCache: Record<string, object> | undefined
let allTalksCache: Set<string> | undefined
const themesCache = new Map<string, Theme>()
const talksCache = new Map<string, Talk>()

// The first existing format wins for extension-less local image references.
export const imageExtensions = ['webp', 'svg', 'gif', 'png', 'jpg', 'bmp']

export async function resolvePusher(): Promise<ParsedSVG> {
  let pusherFile = ''
  let pusher = ''

  if (pusherConfig) {
    const location = await glob(resolve(rootDir, 'node_modules/**/pusher-js/dist/web/pusher.js'), {
      follow: true,
      dot: true
    })

    if (!location.length) {
      throw new Error('Cannot find pusher-js module.')
    }

    pusherFile = location[0]
    pusher = await readFile(pusherFile)
  }

  return [pusherFile, pusher]
}

export function resolveImagePath(cache: Record<string, string>, theme: string, talk: string, path?: string): string {
  path = path?.toString()
  const key = `${theme}:${talk}:${path}`

  if (!path) {
    return ''
  } else if (cache[key]) {
    return cache[key]
  }

  cache[key] = resolve(
    rootDir,
    'src',
    (path ?? '')
      .replace('@common', 'themes/common/assets')
      .replace('@theme', `themes/${theme}/assets`)
      .replace('@talk', `talks/${talk}/assets`)
  )
  return cache[key]
}

export function resolveImageUrl(
  cache: Record<string, string>,
  theme: string,
  talk: string,
  url?: string,
  exporting: boolean = false
): string {
  url = url?.toString()
  const key = `${exporting ? 'export:' : ''}${theme}:${talk}:${url}`

  if (!url) {
    return ''
  } else if (cache[key]) {
    return cache[key]
  }

  const suffixIndex = url.search(/[?#]/)
  const path = suffixIndex === -1 ? url : url.slice(0, suffixIndex)
  const suffix = suffixIndex === -1 ? '' : url.slice(suffixIndex)

  // Explicit extensions and remote URLs never require filesystem checks.
  if (/^@(common|theme|talk)\//.test(path) && !extname(path)) {
    const basePath = resolveImagePath({}, theme, talk, path)
    const candidates = imageExtensions.map(extension => `${basePath}.${extension}`)
    const index = candidates.findIndex(candidate => statSync(candidate, { throwIfNoEntry: false })?.isFile())

    if (index === -1) {
      throw new Error(`Cannot resolve image "${url}". Searched: ${candidates.join(', ')}.`)
    }

    url = `${path}.${imageExtensions[index]}${suffix}`
  }

  cache[key] = url
    .replace('@common', exporting ? './assets/themes/common' : `/${talk}/assets/common`)
    .replace('@theme', exporting ? `./assets/themes/${theme}` : `/${talk}/assets/theme`)
    .replace('@talk', exporting ? `./assets/talks/${talk}` : `/${talk}/assets/talk`)
  return cache[key]
}

export function collectTalkImages(clientContext: ClientContext): {
  images: Set<string>
  commonImages: string[]
  themeImages: string[]
  talkImages: string[]
  resolveImage: ImagesResolver
} {
  const { theme, talk, assets, isExporting } = clientContext
  const images = new Set<string>()
  const commonImages: string[] = []
  const themeImages: string[] = []
  const talkImages: string[] = []
  const resolveImage: ImagesResolver = (themeId, talkId, reference) => {
    const url = resolveImageUrl(assets.images, themeId, talkId, reference, isExporting)

    if (url && !images.has(url)) {
      images.add(url)

      if (reference?.startsWith('@common/')) {
        commonImages.push(url)
      } else if (reference?.startsWith('@theme/')) {
        themeImages.push(url)
      } else {
        talkImages.push(url)
      }
    }

    return url
  }

  // Runtime-only choices must also populate the client resolver cache.
  for (const reference of [...(theme.preloadImages ?? []), ...(talk.config.preloadImages ?? [])]) {
    resolveImage(theme.id, talk.id, reference)
  }

  return { images, commonImages, themeImages, talkImages, resolveImage }
}

export async function getCommon(): Promise<Record<string, object>> {
  if (commonCache) {
    return commonCache
  }

  let loaded: Record<string, object> = {}
  const commonPath = resolve(rootDir, 'src/talks', 'common.yml')

  if (existsSync(commonPath)) {
    loaded = (await load(await readFile(commonPath))) as Record<string, object>
  }

  commonCache = loaded
  return loaded
}

export async function getTheme(themeName: string): Promise<Theme> {
  const cached = themesCache.get(themeName)

  if (cached) {
    return cached
  }

  const themeFile = await readFile(resolve(rootDir, 'src/themes', themeName, 'theme.yml'))
  const theme = load(themeFile) as Theme
  theme.id = themeName

  themesCache.set(themeName, theme)
  return theme
}

export async function getTalk(id: string): Promise<Talk> {
  const cached = talksCache.get(id)

  if (cached) {
    return cached
  }

  let talk: Talk

  if (existsSync(resolve(rootDir, 'src/talks', id, 'slides.yml'))) {
    const infoFile = await readFile(resolve(rootDir, 'src/talks', id, 'info.yml'))
    talk = load(infoFile) as Talk

    const slidesFile = await readFile(resolve(rootDir, 'src/talks', id, 'slides.yml'))
    talk.slides = loadAll(slidesFile) as Slide[]
  } else {
    const talkFile = await readFile(resolve(rootDir, 'src/talks', id, 'talk.yml'))
    talk = load(talkFile) as Talk
  }

  const common = await getCommon()

  if (typeof talk.config === 'string' && talk.config === 'common.config') {
    talk.config = common.config as Config
  }

  for (const [key, value] of Object.entries(talk.document)) {
    if (typeof value === 'string' && value.startsWith('common.')) {
      talk.document[key] = common[value.replace('common.', '') as keyof Config]
    }
  }

  // Set some properties
  talk.id = id
  talk.config.urls = { ...talk.config.urls }
  talk.slidesCount = talk.slides.length
  talk.slidesPadding = Math.ceil(Math.log10(talk.slides.length))
  talk.aspectRatio = talk.config.dimensions.width / talk.config.dimensions.height

  talksCache.set(id, talk)
  return talk
}

export async function getAllTalks(): Promise<Set<string>> {
  if (allTalksCache) {
    return allTalksCache
  }

  const allFiles = await readdir(resolve(rootDir, 'src/talks'))
  allTalksCache = new Set(
    allFiles.filter((talk: string) => {
      return (
        existsSync(resolve(rootDir, 'src/talks', talk, 'talk.yml')) ||
        existsSync(resolve(rootDir, 'src/talks', talk, 'slides.yml'))
      )
    })
  )

  return allTalksCache
}
