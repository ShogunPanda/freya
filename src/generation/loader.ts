import { load } from 'js-yaml'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { markdownRenderer } from './generator.js'
import { getCurrentMode } from './mode.js'
import { RawTheme, Talk, Theme } from './models.js'

export const rootDir = process.cwd()

export function resolveImagePath(theme: string, talk: string, url?: string): string {
  return resolve(
    rootDir,
    'src',
    (url ?? '').replace('@talk', `talks/${talk}/assets`).replace('@theme', `themes/${theme}/assets`)
  )
}

export function resolveImageUrl(theme: string, talk: string, url?: string): string {
  const suffix = getCurrentMode() !== 'production' ? '/assets' : ''

  return (url ?? '')
    .replace('@talk', `/assets/talks/${talk}${suffix}`)
    .replace('@theme', `/assets/themes/${theme}${suffix}`)
}

export async function getTheme(themeName: string): Promise<Theme> {
  let fontsStyles = ''
  const fontsUrls: Array<string> = []
  const theme = load(await readFile(resolve(rootDir, 'src/themes', themeName, 'theme.yml'), 'utf8')) as RawTheme
  const fonts = theme.fonts

  // Generate all the fonts related CSS
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

  return {
    id: themeName,
    ...theme,
    images: theme.images.map(i => resolveImageUrl(themeName, '', i)),
    fontsStyles,
    fontsUrls
  }
}

export async function getTalk(id: string): Promise<Talk> {
  // Get the talk definition
  const talk = load(await readFile(resolve(rootDir, 'src/talks', id, 'talk.yml'), 'utf8')) as Talk

  // Gather all the images
  const images: Array<string> = []

  for (const slide of talk.slides) {
    // Render notes
    slide.notes = markdownRenderer.render(slide.notes ?? '')

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
  talk.slidesCount = talk.slides.length
  talk.slidesPadding = Math.ceil(Math.log10(talk.slides.length))
  talk.aspectRatio = talk.config.dimensions.width / talk.config.dimensions.height
  talk.images = images

  return talk
}

export async function getTalks(): Promise<Set<string>> {
  const allFiles = await readdir(resolve(rootDir, 'src/talks'))
  return new Set(allFiles.filter(talk => existsSync(resolve(rootDir, 'src/talks', talk, 'talk.yml'))))
}
