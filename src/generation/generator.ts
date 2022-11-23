import { createGenerator } from '@unocss/core'
import { FastifyInstance } from 'fastify'
import markdownIt from 'markdown-it'
import { createHash } from 'node:crypto'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { minify } from 'terser'
import { body, header, page } from '../templates/page.js'
import { finalizeCss, transformCSSFile } from './css.js'
import { getTalk, getTalks, getTheme, rootDir } from './loader.js'
import { getCurrentMode } from './mode.js'
import { ClientContext, Context, Slide, SlideRenderer, Talk, Theme } from './models.js'

export const uncachedImportPrefix = '__uncached__'

export const markdownRenderer = markdownIt({
  html: true,
  breaks: true,
  linkify: true
})

// Bypass the Node.js ESM cache by temporarily copying the file to import in a file named after its hash in the same folder
async function uncachedImport<T = any>(path: string): Promise<T> {
  const contents = await readFile(path)
  const md5 = createHash('sha1').update(contents).digest('hex')
  const tmpPath = resolve(dirname(path), `${uncachedImportPrefix}_${basename(path)}_${md5}${extname(path)}`)

  await writeFile(tmpPath, contents)

  try {
    const imported = await import(tmpPath)

    return imported as T
  } finally {
    await unlink(tmpPath)
  }
}

export async function finalizeJs(code: string): Promise<string> {
  const { code: minified } = await minify(code)
  return minified!
}

export function elapsedTime(startTime: bigint): string {
  return (Number(process.hrtime.bigint() - startTime) / 1e6).toFixed(6)
}

export function parseContent(raw?: string): string {
  raw = raw?.toString()

  if (!raw) {
    return ''
  }

  return markdownRenderer
    .render(raw)
    .replace(/^<p>/m, '')
    .replace(/<\/p>$/m, '')
    .trim()
}

export async function generateSlideset(theme: Theme, talk: Talk): Promise<string> {
  const { default: unoConfig } = await uncachedImport(
    resolve(rootDir, 'src/themes', talk.config.theme, 'unocss.config.ts')
  )

  // Prepare the client
  const title = talk.document.title
  const clientContext: ClientContext = {
    mode: getCurrentMode(),
    id: talk.id,
    title,
    dimensions: talk.config.dimensions,
    slidesCount: talk.slidesCount,
    slidesPadding: talk.slidesPadding,
    aspectRatio: talk.aspectRatio,
    current: 0
  }

  // Generate each slide
  const slides: ReactNode[] = []

  for (let i = 0; i < talk.slides.length; i++) {
    const slide = talk.slides[i]

    if (typeof slide.content === 'string') {
      slide.content = [slide.content]
    }

    if (!slide.options) {
      slide.options = {}
    }

    if (!slide.classes) {
      slide.classes = {}
    }

    const { default: layout } = await uncachedImport<{ default: SlideRenderer<Slide> }>(
      resolve(rootDir, 'src/themes', talk.config.theme, 'layouts', (slide.layout ?? 'default') + '.tsx')
    )

    slides.push({ ...layout({ theme, talk, slide, index: i + 1 }), key: `slide:${i + 1}` })
  }

  // Render the page body
  const contents = renderToStaticMarkup(body({ slides }))

  // Extract the CSS
  const generator = createGenerator(unoConfig)
  const { css } = await generator.generate(contents)

  // Generate theme style
  let themeCss = ''
  if (theme.style) {
    themeCss += await transformCSSFile(resolve(rootDir, 'src/themes', theme.id, theme.style), unoConfig)
  }

  // Generate the JS
  const client = await readFile(fileURLToPath(new URL('../assets/client.js', import.meta.url)), 'utf8')

  // Render the page
  const html = renderToStaticMarkup(page(title))
    .replace(
      '@HEAD@',
      renderToStaticMarkup(
        header({
          talk,
          theme,
          css: await finalizeCss(unoConfig, themeCss + css, theme.fontsStyles),
          js: await finalizeJs(client.replace('const context = {}', `const context = ${JSON.stringify(clientContext)}`))
        })
      )
    )
    .replace('@BODY@', contents)

  return html
}

export async function generateSlidesets(context: FastifyInstance | Context): Promise<Record<string, string>> {
  const slidesets: Record<string, string> = {}
  const talks = await getTalks()

  // For each talk, generate all the slideset
  for (const id of talks) {
    const startTime = process.hrtime.bigint()
    const talk = await getTalk(id)
    const theme = await getTheme(talk.config.theme)

    slidesets[id] = await generateSlideset(theme, talk)
    context.log.info(`Generated slideset ${id} in ${elapsedTime(startTime)} ms`)
  }

  return slidesets
}
