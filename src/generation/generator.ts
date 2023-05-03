import { minify } from '@swc/core'
import { createGenerator } from '@unocss/core'
import { glob } from 'glob'
import markdownIt from 'markdown-it'
import { readFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { page as index, body as indexBody } from '../templates/index.js'
import { body, header, page } from '../templates/page.js'
import { cacheKey, loadFromCache, saveToCache } from './cache.js'
import { renderCode } from './code.js'
import { finalizeCss, transformCSSFile } from './css.js'
import { getTalk, getTheme, pusherConfig, rootDir } from './loader.js'
import { ClientContext, Context, Slide, SlideRenderer, Talk, Theme } from './models.js'

export async function resolvePusher(): Promise<[string, string]> {
  let pusherFile = ''
  let pusher = ''

  if (pusherConfig) {
    const location = await glob(resolve(rootDir, 'node_modules/**/pusher-js/dist/web/pusher.js'), { follow: true })

    if (!location.length) {
      throw new Error('Cannot find pusher-js module.')
    }

    pusherFile = location[0]
    pusher = await readFile(pusherFile, 'utf8')
  }

  return [pusherFile, pusher]
}

async function getCacheKeyContent(talk: Talk, theme: Theme, files: Record<string, string>): Promise<string> {
  const key = [`talk:${talk.cacheKey}`, `theme:${theme.cacheKey}`]

  for (const file of await glob(resolve(rootDir, 'src/talks', talk.id, '**/*.*'))) {
    files[relative(rootDir, file)] = file
  }
  for (const file of await glob(resolve(rootDir, 'src/themes', theme.id, '**/*.*'))) {
    files[relative(rootDir, file)] = file
  }

  key.push(
    ...(await Promise.all(
      Object.entries(files).map(async ([key, file]) => {
        return `${key}:${cacheKey(await readFile(file))}`
      })
    ))
  )

  return key.join('\n')
}

export const markdownRenderer = markdownIt({
  html: true,
  breaks: true,
  linkify: true
})

export async function finalizeJs(code: string): Promise<string> {
  const { code: minified } = await minify(code, { compress: true, mangle: false })
  return minified
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

export function renderNotes(slide: Slide): string {
  return slide.notes ? markdownRenderer.render(slide.notes) : ''
}

export async function generateSlideset(context: Context, theme: Theme, talk: Talk): Promise<string> {
  // Gather all files needed for the cache key
  const unoConfigFile = resolve(rootDir, 'tmp/themes', talk.config.theme, 'unocss.config.js')
  const clientJsFile = fileURLToPath(new URL('../assets/client.js', import.meta.url))
  const [pusherFile, pusher] = await resolvePusher()
  const themeStyle = resolve(rootDir, 'src/themes', theme.id, theme.style)

  const key = await getCacheKeyContent(talk, theme, { uno: unoConfigFile, client: clientJsFile, pusher: pusherFile })

  const cached = await loadFromCache<string>(key, context.log)

  if (cached) {
    context.log.debug(`Loaded slideset "${talk.id}" from cache.`)
    return cached
  }

  const environment = context.environment
  const { default: unoConfig } = await import(unoConfigFile)

  // Prepare the client
  const title = talk.document.title
  const clientContext: ClientContext = {
    id: talk.id,
    title,
    dimensions: talk.config.dimensions,
    slidesCount: talk.slidesCount,
    slidesPadding: talk.slidesPadding,
    aspectRatio: talk.aspectRatio,
    current: 0,
    environment,
    pusher: pusherConfig
      ? {
          key: pusherConfig.key,
          cluster: pusherConfig.cluster,
          hostname: environment === 'development' ? hostname() : undefined
        }
      : undefined
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

    if (slide.code && !slide.code.rendered) {
      const cachedCode = await loadFromCache<string>(`code:${slide.code.content}`, context.log)

      if (cachedCode) {
        slide.code.rendered = cachedCode
      } else {
        slide.code.rendered = await renderCode(slide.code)
        await saveToCache(`code:${slide.code.content}`, slide.code.rendered)
      }
    }

    const { default: layout }: { default: SlideRenderer<Slide> } = await import(
      resolve(rootDir, 'tmp/themes', talk.config.theme, 'layouts', (slide.layout ?? 'default') + '.js')
    )

    slides.push({ ...layout({ environment, theme, talk, slide, index: i + 1 }), key: `slide:${i + 1}` })
  }

  // Render the page body
  const contents = renderToStaticMarkup(body({ slides }))

  // Extract the CSS
  const generator = createGenerator(unoConfig)
  const { css } = await generator.generate(contents)

  // Generate theme style
  let themeCss = ''
  if (theme.style) {
    themeCss += await transformCSSFile(themeStyle, unoConfig)
  }

  // Generate the JS
  const client = await readFile(clientJsFile, 'utf8')

  // Render the page
  const html = renderToStaticMarkup(page(title))
    .replace(
      '@HEAD@',
      renderToStaticMarkup(
        header({
          talk,
          theme,
          css: await finalizeCss(unoConfig, themeCss + css, theme.fontsStyles),
          js: await finalizeJs(
            pusher + '\n' + client.replace('const context = {}', `const context = ${JSON.stringify(clientContext)}`)
          )
        })
      )
    )
    .replace('@BODY@', contents)

  await saveToCache(key, html)
  return html
}

export async function generateSlidesets(context: Context): Promise<Record<string, string>> {
  const slidesets: Record<string, string> = {}

  const resolvedTalks: Record<string, Talk> = {}

  // For each talk, generate all the slideset
  for (const id of context.talks) {
    const startTime = process.hrtime.bigint()
    const talk = await getTalk(id, context.log)
    const theme = await getTheme(talk.config.theme, context.log)

    resolvedTalks[id] = talk
    slidesets[id] = await generateSlideset(context, theme, talk)
    context.log.info(`Generated slideset ${id} in ${elapsedTime(startTime)} ms.`)
  }

  // Generate the index file
  slidesets.index = renderToStaticMarkup(index()).replace(
    '@BODY@',
    renderToStaticMarkup(indexBody({ talks: resolvedTalks }))
  )

  return slidesets
}
