import { minify } from '@swc/core'
import {
  baseTemporaryDirectory,
  danteDir,
  elapsed,
  expandCSSClasses,
  loadCSSClassesExpansion,
  renderCode,
  rootDir,
  type BuildContext,
  type CSSClassesResolver,
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
import { pusherConfig } from '../configuration.js'
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

  const resolveClasses = context.extensions.freya.resolveClasses
  classes.root = resolveClasses('freya@code__wrapper')
  classes.line = resolveClasses('freya@code__line')
  classes.lineHighlighted = resolveClasses('freya@code__line--highlighted')
  classes.lineNumber = resolveClasses('freya@code__line-number')

  const { content, language, numbers, highlight } = target.code
  target.code.rendered = await renderCode(content, language ?? '', numbers ?? false, highlight ?? '', classes)
  codeCache.set(cacheKey, target.code.rendered)
}

function createCSSClassesResolver(id: string, context: BuildContext, classes: ClassesExpansions): CSSClassesResolver {
  // Create a subcontext to keep CSS scoped
  context.extensions.freya.css[id] = {
    keepExpanded: context.css.keepExpanded,
    currentClasses: new Set(),
    compressedClasses: new Map(),
    compressionState: 0
  }

  // Override the default scope
  context.css = context.extensions.freya.css[id]

  return expandCSSClasses.bind(null, context, classes)
}

export async function generateAssetsListing(context: BuildContext): Promise<Record<string, string>> {
  const classes = await loadCSSClassesExpansion(
    await readFile(new URL('../assets/styles/classes.css', import.meta.url), 'utf-8')
  )

  const resolveClasses = createCSSClassesResolver('__assets', context, classes)
  context.extensions.freya.resolveClasses = resolveClasses
  const bodyClassName = resolveClasses('freya@assets__body')

  const pages: Record<string, string> = {}

  // For each talk, generate all the slideset
  const talks = context.extensions.freya.talks as Set<string>
  const total = talks.size
  const totalPadded = total.toString()
  let i = 0
  const padding = totalPadded.length

  for (const id of talks) {
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

    const body = assetsBody({ context, talk, talkAssets, themeAssets })
    const page = assetsPage(context, bodyClassName)
    pages[id] = renderToStaticMarkup(page).replace('@BODY@', renderToStaticMarkup(body))

    const progress = `[${i.toString().padStart(padding, '0')}/${totalPadded}]`
    context.logger.info(`${progress} Generated assets listing for slideset ${id} in ${elapsed(startTime)} ms.`)
  }

  return pages
}

export async function generateSlideset(context: BuildContext, theme: Theme, talk: Talk): Promise<string> {
  // Gather all files needed for the cache key
  const clientJsFile = fileURLToPath(new URL('../assets/js/slideset.js', import.meta.url))
  const hotReloadFile = !context.isProduction ? resolve(danteDir, 'dist/assets/hot-reload.js') : ''
  const serviceWorkerFile = context.isProduction
    ? fileURLToPath(new URL('../assets/js/service-worker.js', import.meta.url))
    : ''

  const [, pusher] = await resolvePusher()

  // Load theme classes and layers, if any
  const themeClassesFile = resolve(rootDir, 'src/themes', theme.id, 'classes.css')
  const themeClasses = existsSync(themeClassesFile) ? await readFile(themeClassesFile, 'utf-8') : ''

  const classes = await loadCSSClassesExpansion(
    (await readFile(new URL('../assets/styles/classes.css', import.meta.url), 'utf-8')) + themeClasses
  )

  const resolveClasses = createCSSClassesResolver(talk.id, context, classes)
  context.extensions.freya.resolveClasses = resolveClasses

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
    isProduction: context.isProduction,
    classes: {
      hidden: resolveClasses('js@hidden'),
      wrapped: resolveClasses('js@slide'),
      listActive: resolveClasses('js@slides__wrapper--active')
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

    for (const item of (slide.items as BaseSlide[]) ?? []) {
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
          context,
          talk,
          theme,
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
  const talks = context.extensions.freya.talks as Set<string>
  const total = talks.size
  const totalPadded = total.toString()
  let i = 0
  const padding = totalPadded.length
  for (const id of talks) {
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
  const classes = await loadCSSClassesExpansion(
    await readFile(new URL('../assets/styles/classes.css', import.meta.url), 'utf-8')
  )

  const resolveClasses = createCSSClassesResolver('__index', context, classes)
  context.extensions.freya.resolveClasses = resolveClasses

  const bodyClassName = resolveClasses('freya@index__body')
  const body = indexBody({ context, talks: resolvedTalks })
  const indexJSX = await index(context, bodyClassName)
  slidesets.index = renderToStaticMarkup(indexJSX).replace('@BODY@', renderToStaticMarkup(body))

  return slidesets
}
