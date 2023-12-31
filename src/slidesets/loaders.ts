import { rootDir } from '@perseveranza-pets/dante'
import { glob } from 'glob'
import { load, loadAll } from 'js-yaml'
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pusherConfig } from '../configuration.js'
import { type Config, type ParsedSVG, type RawTheme, type Slide, type Talk, type Theme } from './models.js'

let commonCache: Record<string, object> | undefined
let allTalksCache: Set<string> | undefined
const themesCache = new Map<string, Theme>()
const talksCache = new Map<string, Talk>()

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
    pusher = await readFile(pusherFile, 'utf8')
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
    (path ?? '').replace('@talk', `talks/${talk}/assets`).replace('@theme', `themes/${theme}/assets`)
  )
  return cache[key]
}

export function resolveImageUrl(cache: Record<string, string>, theme: string, talk: string, url?: string): string {
  url = url?.toString()
  const key = `${theme}:${talk}:${url}`

  if (!url) {
    return ''
  } else if (cache[key]) {
    return cache[key]
  }

  cache[key] = url.replace('@talk', `/assets/talks/${talk}`).replace('@theme', `/assets/themes/${theme}`)
  return cache[key]
}

export async function getCommon(): Promise<Record<string, object>> {
  if (commonCache) {
    return commonCache
  }

  let loaded: Record<string, object> = {}
  const commonPath = resolve(rootDir, 'src/talks', 'common.yml')

  if (existsSync(commonPath)) {
    loaded = (await load(await readFile(commonPath, 'utf8'))) as Record<string, object>
  }

  commonCache = loaded
  return loaded
}

export async function getTheme(themeName: string): Promise<Theme> {
  const cached = themesCache.get(themeName)

  if (cached) {
    return cached
  }

  let fontsStyles = ''
  const fontsUrls = new Set<string>()

  const themeFile = await readFile(resolve(rootDir, 'src/themes', themeName, 'theme.yml'), 'utf8')
  const rawTheme = load(themeFile) as RawTheme
  const fonts = rawTheme.fonts

  // Generate all the fonts related CSS
  if (fonts.families && fonts.ranges) {
    for (const [name, styles] of Object.entries(fonts.families)) {
      for (const [style, weights] of Object.entries(styles)) {
        for (const [weight, definition] of Object.entries(weights)) {
          for (const [range, url] of Object.entries(definition)) {
            fontsStyles +=
              `
@font-face {
  font-family: "${name}";
  font-style: ${style};
  font-weight: ${weight};
  font-display: swap;
  src: url(${url}) format('woff2');
  unicode-range: ${fonts.ranges[range]}
}
        `.trim() + '\n'

            fontsUrls.add(url)
          }
        }
      }
    }
  }

  const theme = {
    id: themeName,
    urls: {},
    ...rawTheme,
    images: Array.from(new Set((rawTheme.images ?? []).map(i => resolveImageUrl({}, themeName, '', i)))),
    fontsStyles,
    fontsUrls: Array.from(fontsUrls)
  }

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
    const infoFile = await readFile(resolve(rootDir, 'src/talks', id, 'info.yml'), 'utf8')
    talk = load(infoFile) as Talk

    const slidesFile = await readFile(resolve(rootDir, 'src/talks', id, 'slides.yml'), 'utf8')
    talk.slides = loadAll(slidesFile) as Slide[]
  } else {
    const talkFile = await readFile(resolve(rootDir, 'src/talks', id, 'talk.yml'), 'utf8')
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

  // Gather all images
  const images = new Set<string>()

  for (const slide of talk.slides) {
    // Track the included images
    for (const property of ['image']) {
      const image = slide[property] as string

      if (image) {
        images.add(resolveImageUrl({}, talk.config.theme, id, image)!)
      }
    }
  }

  // Set some properties
  talk.id = id
  talk.config.urls = { ...talk.config.urls }
  talk.slidesCount = talk.slides.length
  talk.slidesPadding = Math.ceil(Math.log10(talk.slides.length))
  talk.aspectRatio = talk.config.dimensions.width / talk.config.dimensions.height
  talk.images = Array.from(images)

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
