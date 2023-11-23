import { minify } from '@swc/core'
import {
  baseTemporaryDirectory,
  compressCSSClasses,
  danteDir,
  elapsed,
  expandClasses,
  loadClassesExpansion,
  prepareStyles,
  rootDir,
  type BuildContext,
  type ClassesExpansions
} from 'dante'
import { glob, type IgnoreLike } from 'glob'
import markdownIt from 'markdown-it'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { safelist } from '../build.js'
import { pusherConfig } from '../configuration.js'
import { renderCode } from '../rendering/code.js'
import { body as assetsBody, page as assetsPage } from '../templates/assets.js'
import { page as index, body as indexBody } from '../templates/index.js'
import { body, header, page } from '../templates/page.js'
import { getTalk, getTheme, resolvePusher } from './loaders.js'
import { type BaseSlide, type ClientContext, type Slide, type SlideRenderer, type Talk, type Theme } from './models.js'

interface Path {
  name: string
}

const codeCache = new Map<string, string>()

const ignore: IgnoreLike = {
  ignored(p: Path): boolean {
    return p.name.startsWith('__')
  },
  childrenIgnored(p: Path): boolean {
    return p.name.startsWith('__')
  }
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

function assetsSorter(left: string, right: string): number {
  if (left.startsWith('icons/') && !right.startsWith('icons/')) {
    return -1
  } else if (!left.startsWith('icons/') && right.startsWith('icons/')) {
    return 1
  }

  return left.localeCompare(right)
}

function prepareClientClasses(context: BuildContext, talk: string, safelist: Set<string>, klasses: string): string {
  const compressedClasses = context.extensions.css.compressedClasses[talk]
  const generator = context.extensions.css.generator[talk]

  if (context.css.keepExpanded) {
    return context.extensions.expandClasses(klasses)
  }

  return compressCSSClasses(
    context.extensions.expandClasses(klasses).split(' '),
    compressedClasses,
    safelist,
    generator
  ).join(' ')
}

export function renderNotes(slide: Slide): string {
  return slide.notes ? markdownRenderer.render(slide.notes) : ''
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

async function ensureRenderedCode(context: BuildContext, target: BaseSlide): Promise<void> {
  if (!target.code || target.code?.rendered) {
    return
  }

  const cacheKey = `code:${target.code.language}:${target.code.content}`
  const renderedCode = codeCache.get(cacheKey)

  if (renderedCode) {
    target.code.rendered = renderedCode
    return
  }

  const classes: Record<string, string> = {}

  if (typeof context.extensions.expandClasses === 'function') {
    classes.root = context.extensions.expandClasses('freya@code__wrapper')
    classes.line = context.extensions.expandClasses('freya@code__line')
    classes.lineHighlighted = context.extensions.expandClasses('freya@code__line--highlighted')
    classes.lineNumber = context.extensions.expandClasses('freya@code__line-number')
  }

  target.code.rendered = await renderCode(target.code, classes)
  codeCache.set(cacheKey, target.code.rendered)
}

export async function generateAssetsListing(context: BuildContext): Promise<Record<string, string>> {
  const pages: Record<string, string> = {}
  const page = assetsPage()

  // For each talk, generate all the slideset
  const total = context.extensions.talks.size
  const totalPadded = total.toString()
  let i = 0
  const padding = totalPadded.length

  for (const id of context.extensions.talks) {
    i++
    const startTime = process.hrtime.bigint()
    const talk = await getTalk(id)

    const talkPaths = await glob('**/*.{bmp,gif,jpg,jpeg,png,webp,svg}', {
      cwd: resolve(rootDir, 'src/talks', id, 'assets'),
      ignore
    })

    const themePaths = await glob('**/*.{bmp,gif,jpg,jpeg,png,webp,svg}', {
      cwd: resolve(rootDir, 'src/themes', talk.config.theme, 'assets'),
      ignore
    })

    const talkAssets: [string, string][] = []
    for (const asset of talkPaths.sort(assetsSorter)) {
      talkAssets.push([asset, `/assets/talks/${id}/${asset}`])
    }

    const themeAssets: [string, string][] = []
    for (const asset of themePaths.sort(assetsSorter)) {
      themeAssets.push([asset, `/assets/themes/${talk.config.theme}/${asset}`])
    }

    pages[id] = renderToStaticMarkup(page).replace(
      '@BODY@',
      renderToStaticMarkup(assetsBody({ talk, talkAssets, themeAssets }))
    )
    const progress = `[${i.toString().padStart(padding, '0')}/${totalPadded}]`
    context.logger.info(`${progress} Generated assets listing for slideset ${id} in ${elapsed(startTime)} ms.`)
  }

  return pages
}

function expandPageClasses(expansions: ClassesExpansions, klasses?: string): string {
  return expandClasses(expansions, klasses)
}

export async function generateSlideset(context: BuildContext, theme: Theme, talk: Talk): Promise<string> {
  // Gather all files needed for the cache key
  const clientJsFile = fileURLToPath(new URL('../assets/js/slideset.js', import.meta.url))
  const hotReloadFile = !context.isProduction ? resolve(danteDir, 'dist/assets/hot-reload-trigger.js') : ''
  const serviceWorkerFile = context.isProduction
    ? fileURLToPath(new URL('../assets/js/service-worker.js', import.meta.url))
    : ''

  const [, pusher] = await resolvePusher()

  // Loaded theme classes, if any
  const themeClassesFile = resolve(rootDir, 'src/themes', theme.id, 'classes.css')
  const themeClasses = existsSync(themeClassesFile) ? await readFile(themeClassesFile, 'utf-8') : ''

  context.currentPage = talk.id
  context.extensions.css.classesExpansions[talk.id] = await loadClassesExpansion(
    (await readFile(new URL('../assets/styles/classes.css', import.meta.url), 'utf-8')) + themeClasses
  )
  context.extensions.expandClasses = expandPageClasses.bind(null, context.extensions.css.classesExpansions[talk.id])

  // Prepare the client
  const finalSafelist = new Set(await safelist(context))
  const title = talk.document.title
  const clientContext: ClientContext = {
    id: talk.id,
    title,
    dimensions: talk.config.dimensions,
    slidesCount: talk.slidesCount,
    slidesPadding: talk.slidesPadding,
    aspectRatio: talk.aspectRatio,
    current: 0,
    isProduction: context.isProduction,
    classes: {
      hidden: prepareClientClasses(context, talk.id, finalSafelist, 'js@hidden'),
      wrapped: prepareClientClasses(context, talk.id, finalSafelist, `js@slide js@${talk.id}`),
      listActive: prepareClientClasses(context, talk.id, finalSafelist, 'js@slides__wrapper--active')
    },
    pusher: pusherConfig
      ? {
          key: pusherConfig.key,
          cluster: pusherConfig.cluster,
          hostname: context.isProduction ? hostname() : undefined
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

    await ensureRenderedCode(context, slide)

    for (const item of slide.items ?? []) {
      await ensureRenderedCode(context, item)
    }

    const { default: layout }: { default: SlideRenderer<Slide> } = await import(
      resolve(
        rootDir,
        baseTemporaryDirectory,
        'themes',
        talk.config.theme,
        'layouts',
        (slide.layout ?? 'default') + '.js'
      )
    )

    slides.push({ ...layout({ context, theme, talk, slide, index: i + 1 }), key: `slide:${i + 1}` })
  }

  // Render the page body
  const contents = renderToStaticMarkup(body({ context, slides }))

  // Extract the CSS
  const css = await prepareStyles(context, contents)

  // Generate the JS
  const siteVersion = `globalThis.__freyaSiteVersion = "${context.version}"`
  const hotReload = hotReloadFile ? await readFile(hotReloadFile, 'utf8') : ''
  const serviceWorker = serviceWorkerFile ? await readFile(serviceWorkerFile, 'utf8') : ''
  const client = await readFile(clientJsFile, 'utf8')

  // Render the page
  const html = renderToStaticMarkup(page(title))
    .replace(
      '@HEAD@',
      renderToStaticMarkup(
        header({
          talk,
          theme,
          css,
          js: await finalizeJs(
            [
              siteVersion,
              hotReload,
              serviceWorker,
              pusher,
              client.replace('const context = {}', `const context = ${JSON.stringify(clientContext)}`)
            ].join('\n;\n')
          )
        })
      )
    )
    .replace('@BODY@', contents)

  return html
}

export async function generateAllSlidesets(context: BuildContext): Promise<Record<string, string>> {
  const slidesets: Record<string, string> = {}
  const resolvedTalks: Record<string, Talk> = {}

  // For each talk, generate all the slideset
  const total = context.extensions.talks.size
  const totalPadded = total.toString()
  let i = 0
  const padding = totalPadded.length
  for (const id of context.extensions.talks) {
    i++
    const startTime = process.hrtime.bigint()
    const talk = await getTalk(id)
    const theme = await getTheme(talk.config.theme)

    resolvedTalks[id] = talk
    slidesets[id] = await generateSlideset(context, theme, talk)

    const progress = `[${i.toString().padStart(padding, '0')}/${totalPadded}]`
    context.logger.info(`${progress} Generated slideset ${id} in ${elapsed(startTime)} ms.`)
  }

  // Generate the index file
  const indexJSX = await index(context)
  slidesets.index = renderToStaticMarkup(indexJSX).replace(
    '@BODY@',
    renderToStaticMarkup(indexBody({ talks: resolvedTalks }))
  )

  return slidesets
}