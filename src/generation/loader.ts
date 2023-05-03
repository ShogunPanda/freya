import { glob } from 'glob'
import { load } from 'js-yaml'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { isMainThread } from 'node:worker_threads'
import { BaseLogger } from 'pino'
import { cacheKey, loadFromCache, saveToCache } from './cache.js'
import { Config, Pusher, RawTheme, Talk, Theme } from './models.js'

function loadPusherSettings(): Pusher | undefined {
  const { PUSHER_KEY: key, PUSHER_SECRET: secret, PUSHER_CLUSTER: cluster } = process.env

  if (!key || !secret || !cluster) {
    if (!isMainThread) {
      process.emitWarning(
        'In order to enable synchronization, please define PUSHER_KEY, PUSHER_SECRET and PUSHER_CLUSTER environment variables.'
      )
    }

    return undefined
  }

  return { key, secret, cluster }
}

export const rootDir = process.cwd()
export const pusherConfig = loadPusherSettings()
let swc: string

export async function resolveSwc(): Promise<string> {
  const location = await glob(resolve(rootDir, 'node_modules/**/@swc/cli/bin/swc.js'), { follow: true })

  if (!location.length) {
    throw new Error('Cannot find swc.')
  }

  swc = location[0]
  return swc
}

export function resolveImagePath(theme: string, talk: string, url?: string): string {
  return resolve(
    rootDir,
    'src',
    (url ?? '').replace('@talk', `talks/${talk}/assets`).replace('@theme', `themes/${theme}/assets`)
  )
}

export function resolveImageUrl(theme: string, talk: string, url?: string): string {
  return (url ?? '').replace('@talk', `/assets/talks/${talk}`).replace('@theme', `/assets/themes/${theme}`)
}

export async function getTheme(themeName: string, logger?: BaseLogger): Promise<Theme> {
  let fontsStyles = ''
  const fontsUrls: string[] = []

  const themeFile = await readFile(resolve(rootDir, 'src/themes', themeName, 'theme.yml'), 'utf8')

  const cached = await loadFromCache<Theme>(themeFile, logger)

  if (cached) {
    logger?.debug(`Loaded theme "${themeName}" from cache.`)
    return cached
  }

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

            fontsUrls.push(url)
          }
        }
      }
    }
  }

  const theme = {
    id: themeName,
    urls: {},
    ...rawTheme,
    images: (rawTheme.images ?? []).map(i => resolveImageUrl(themeName, '', i)),
    fontsStyles,
    fontsUrls,
    cacheKey: cacheKey(themeFile)
  }

  await saveToCache(themeFile, theme)

  return theme
}

export async function getTalk(id: string, logger?: BaseLogger): Promise<Talk> {
  const talkFile = await readFile(resolve(rootDir, 'src/talks', id, 'talk.yml'), 'utf8')

  const cached = await loadFromCache<Talk>(talkFile, logger)

  if (cached) {
    logger?.debug(`Loaded talk "${id}" from cache.`)
    return cached
  }

  // Get the talk definition
  const talk = load(talkFile) as Talk

  // If there is a common.yml file in the talks folder, load it
  const commonPath = resolve(rootDir, 'src/talks', 'common.yml')

  if (existsSync(commonPath)) {
    const common = (await load(await readFile(commonPath, 'utf8'))) as Record<string, object>

    if (typeof talk.config === 'string' && talk.config === 'common.config') {
      talk.config = common.config as Config
    }

    for (const [key, value] of Object.entries(talk.document)) {
      if (typeof value === 'string' && value.startsWith('common.')) {
        talk.document[key] = common[value.replace('common.', '')]
      }
    }
  }

  // Gather all images
  const images: string[] = []

  for (const slide of talk.slides) {
    // Track the included images
    for (const property of ['image']) {
      const image = slide[property]

      if (image) {
        images.push(resolveImageUrl(talk.config.theme, id, image)!)
      }
    }
  }

  // Set some properties
  talk.id = id
  talk.config.urls = { ...talk.config.urls }
  talk.slidesCount = talk.slides.length
  talk.slidesPadding = Math.ceil(Math.log10(talk.slides.length))
  talk.aspectRatio = talk.config.dimensions.width / talk.config.dimensions.height
  talk.images = images
  talk.cacheKey = cacheKey(talkFile)

  await saveToCache(talkFile, talk)
  return talk
}

export async function getTalks(): Promise<Set<string>> {
  const allFiles = await readdir(resolve(rootDir, 'src/talks'))
  return new Set(allFiles.filter((talk: string) => existsSync(resolve(rootDir, 'src/talks', talk, 'talk.yml'))))
}
