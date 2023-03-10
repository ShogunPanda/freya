import { load } from 'js-yaml'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isMainThread } from 'node:worker_threads'
import { getHighlighter, Lang, renderToHtml } from 'shiki'
import { markdownRenderer } from './generator.js'
import { Config, Pusher, RawTheme, Slide, Talk, Theme } from './models.js'

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

export let swc = resolve(rootDir, 'node_modules/.bin/swc')

if (!existsSync(swc)) {
  swc = fileURLToPath(new URL('../../node_modules/.bin/swc', import.meta.url))
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

export function parseRanges(highlight: any): number[][] {
  return (highlight ?? '')
    .split(',')
    .map((raw: string) => {
      const parsed = raw
        .trim()
        .split('-')
        .map(r => Number.parseInt(r))
        .filter(r => !Number.isNaN(r))

      switch (parsed.length) {
        case 0:
          return null
        case 1:
          return [parsed[0], parsed[0]]
        default:
          return parsed.slice(0, 2)
      }
    })
    .filter(Boolean)
}

export async function renderCode(
  { content, language, numbers, highlight }: Slide['code'],
  theme: string = 'one-dark-pro'
): Promise<string> {
  if (!language) {
    language = 'javascript'
  }

  const highlighter = await getHighlighter({ langs: [language as unknown as Lang], themes: [theme] })
  const tokens = highlighter.codeToThemedTokens(content.trim(), language, 'one-dark-pro')
  const { fg, bg } = highlighter.getTheme(theme)

  let i = 0
  const ranges = parseRanges(highlight)

  return renderToHtml(tokens, {
    elements: {
      line({ className, children }: Record<string, unknown>): string {
        i++
        const nextRange = ranges[0]

        // There is a range to higlight
        if (nextRange) {
          // We have to highlight
          if (nextRange[0] <= i && nextRange[1] >= i) {
            ;(className as string) += ' highlighted'

            // If it was a single line, make sure we move to the next range
            if (nextRange[0] === nextRange[1]) {
              ranges.shift()
            }
            // We're past the previous range, look for the next one
          } else if (nextRange[0] <= i) {
            ranges.shift()
          }
        }
        const lineNumberSpan = numbers !== false ? `<span class="line-number">${i}</span>` : ''
        return `<span class="${className}">${lineNumberSpan}${children}</span>`
      }
    },
    fg,
    bg,
    themeName: theme
  })
}

export async function getTheme(themeName: string): Promise<Theme> {
  let fontsStyles = ''
  const fontsUrls: string[] = []
  const theme = load(await readFile(resolve(rootDir, 'src/themes', themeName, 'theme.yml'), 'utf8')) as RawTheme
  const fonts = theme.fonts

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

  return {
    id: themeName,
    urls: {},
    ...theme,
    images: (theme.images ?? []).map(i => resolveImageUrl(themeName, '', i)),
    fontsStyles,
    fontsUrls
  }
}

export async function getTalk(id: string): Promise<Talk> {
  // Get the talk definition
  const talk = load(await readFile(resolve(rootDir, 'src/talks', id, 'talk.yml'), 'utf8')) as Talk

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

  // Gather all the images
  const images: string[] = []

  for (const slide of talk.slides) {
    // Render notes
    slide.notes = markdownRenderer.render(slide.notes ?? '')

    // Render code
    if (slide.code) {
      slide.code.rendered = await renderCode(slide.code)
    }

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

  return talk
}

export async function getTalks(): Promise<Set<string>> {
  const allFiles = await readdir(resolve(rootDir, 'src/talks'))
  return new Set(allFiles.filter((talk: string) => existsSync(resolve(rootDir, 'src/talks', talk, 'talk.yml'))))
}
