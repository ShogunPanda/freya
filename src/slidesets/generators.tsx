import {
  baseTemporaryDirectory,
  cleanCssClasses,
  elapsed,
  renderCode,
  rootDir,
  sanitizeTabularOutputSnippet,
  type BuildContext
} from '@perseveranza-pets/dante'
import rollupCommonJs from '@rollup/plugin-commonjs'
import rollupNodeResolve from '@rollup/plugin-node-resolve'
import rollupReplace from '@rollup/plugin-replace'
import { minify, transform } from '@swc/core'
import { glob, type IgnoreLike } from 'glob'
import markdownIt from 'markdown-it'
import { existsSync } from 'node:fs'
import { hostname } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from 'preact-render-to-string'
import { rollup } from 'rollup'
import { generateSVGId } from '../components/svg.js'
import { pusherConfig } from '../configuration.js'
import { resolveSVG } from '../rendering/svg.js'
import { page as page404 } from '../templates/404.js'
import { page as assetsPage } from '../templates/assets.js'
import { page as index } from '../templates/index.js'
import { page } from '../templates/page.js'
import { SlideComponent, Widgets } from '../templates/slide.js'
import { getTalk, getTheme, resolveImageUrl, resolvePusher } from './loaders.js'
import {
  type ClientContext,
  type CodeDefinition,
  type ParsedSVG,
  type Slide,
  type SlideRenderer,
  type Talk,
  type Theme
} from './models.js'

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

function camelCase(source: any): string {
  if (typeof source !== 'string' || !source.length) {
    return source
  }

  return source
    .toLowerCase()
    .replaceAll(/[^\d\sa-z]/g, ' ')
    .replaceAll(/(^.|\s.)/g, (...t) => t[1].toUpperCase())
}

function assetsSorter(left: string, right: string): number {
  if (left.startsWith('icons/') && !right.startsWith('icons/')) {
    return -1
  } else if (!left.startsWith('icons/') && right.startsWith('icons/')) {
    return 1
  }

  return left.localeCompare(right)
}

async function loadIcon(
  svgs: Record<string, ParsedSVG>,
  svgsDefinitions: string[],
  id: string,
  name: string
): Promise<void> {
  const fileName = `fa${camelCase(`${name}`).replaceAll(/\s/g, '')}.js`
  const path = `node_modules/@fortawesome/free-solid-svg-icons/${fileName}`
  const { width, height, svgPathData } = await import(resolve(process.cwd(), path))
  const definitionId = generateSVGId(svgsDefinitions.length)

  // Generate the ID
  svgs[id] = [definitionId, `0 0 ${width} ${height}`]
  svgsDefinitions.push(
    render(
      <svg id={definitionId} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${height}`}>
        {[svgPathData].flat(1).map((p, i) => (
          <path key={i} d={p} />
        ))}
      </svg>
    )
  )
}

export const markdownRenderer = markdownIt({
  html: true,
  breaks: true,
  linkify: true
})

export async function listThemeAndTalkImages(theme: string, talk: string): Promise<[string[], string[], string[]]> {
  const commonImagesPaths = await glob('**/*.{bmp,gif,jpg,jpeg,png,webp,svg}', {
    cwd: resolve(rootDir, 'src/themes/common/assets'),
    ignore
  })

  const themeImagesPaths = await glob('**/*.{bmp,gif,jpg,jpeg,png,webp,svg}', {
    cwd: resolve(rootDir, 'src/themes', theme, 'assets'),
    ignore
  })

  const talkImagesPaths = await glob('**/*.{bmp,gif,jpg,jpeg,png,webp,svg}', {
    cwd: resolve(rootDir, 'src/talks', talk, 'assets'),
    ignore
  })

  return [
    commonImagesPaths.sort(assetsSorter).map(a => `@common/${a}`),
    themeImagesPaths.sort(assetsSorter).map(a => `@theme/${a}`),
    talkImagesPaths.sort(assetsSorter).map(a => `@talk/${a}`)
  ]
}

export async function finalizeJs(code: string): Promise<string> {
  const { code: minified } = await minify(code, { compress: true, mangle: false })
  return minified
}

export function renderNotes(slide: Slide): string {
  return slide.notes ? markdownRenderer.render(slide.notes) : ''
}

export function parseContent(cache: Record<string, string>, raw?: string): string {
  raw = raw?.toString()

  if (!raw) {
    return ''
  } else if (cache[raw]) {
    return raw
  }

  cache[raw] = markdownRenderer
    .render(raw)
    .replace(/^<p>/m, '')
    .replace(/<\/p>$/m, '')
    .trim()

  return cache[raw]
}

export async function ensureRenderedCode(code: CodeDefinition): Promise<void> {
  if (!code || code?.rendered) {
    return
  }

  const cacheKey = JSON.stringify(code)
  const renderedCode = codeCache.get(cacheKey)

  if (renderedCode) {
    code.rendered = renderedCode
    return
  }

  const userClasses = code.className ?? {}
  const classes: Record<string, string> = {}

  classes.root = cleanCssClasses('freya@code', userClasses.root)
  classes.line = cleanCssClasses('freya@code__line', userClasses.line)
  classes.lineHighlighted = cleanCssClasses('freya@code__line--highlighted', userClasses.lineHighlighted)
  classes.lineNotHighlighted = cleanCssClasses('freya@code__line--not-highlighted', userClasses.lineNotHighlighted)
  classes.lineNumber = cleanCssClasses('freya@code__line-number', userClasses.lineNumber)

  const { language, numbers, highlight } = code
  let content = code.content

  if (language === 'none') {
    content = sanitizeTabularOutputSnippet(content)
  }

  code.rendered = await renderCode(content, language ?? '', numbers ?? false, highlight ?? '', classes)
  codeCache.set(cacheKey, code.rendered)
}

async function loadData(
  context: BuildContext,
  theme: Theme,
  talk: Talk,
  file: string,
  clientData: Record<string, any>,
  serverData: Record<string, any>,
  key: string
): Promise<void> {
  if (!existsSync(file)) {
    return
  }

  const { setupClient, setupServer } = await import(file)

  if (typeof setupClient === 'function') {
    clientData[key] = await setupClient(context, theme, talk)
  }

  if (typeof setupServer === 'function') {
    serverData[key] = await setupServer(context, theme, talk)
  }
}

export async function prepareClientContext(context: BuildContext, theme: Theme, talk: Talk): Promise<ClientContext> {
  const content: Record<string, string> = {}
  const images: Record<string, string> = {}
  const svgsDefinitions: string[] = []
  const svgs: Record<string, ParsedSVG> = {}

  // Load UI icons
  await loadIcon(svgs, svgsDefinitions, 'arrow-left', 'chevron-left')
  await loadIcon(svgs, svgsDefinitions, 'arrow-right', 'chevron-right')
  await loadIcon(svgs, svgsDefinitions, 'navigator', 'table-cells')
  await loadIcon(svgs, svgsDefinitions, 'maximize', 'expand')
  await loadIcon(svgs, svgsDefinitions, 'minimize', 'compress')
  await loadIcon(svgs, svgsDefinitions, 'play', 'play')
  await loadIcon(svgs, svgsDefinitions, 'reset', 'arrow-rotate-left')
  await loadIcon(svgs, svgsDefinitions, 'close', 'xmark')

  // Load theme and talk data, if any
  const data: Record<string, any> = {}
  const serverData: Record<string, any> = {}

  const themeSetupFile = resolve(baseTemporaryDirectory, 'themes', theme.id, 'setup.js')
  const talkSetupFile = resolve(baseTemporaryDirectory, 'talk', talk.id, 'setup.js')

  await loadData(context, theme, talk, themeSetupFile, data, serverData, 'theme')
  await loadData(context, theme, talk, talkSetupFile, data, serverData, 'talk')

  // Prepare the client
  return {
    version: context.version,
    id: talk.id,
    talk,
    theme,
    assets: { content, images, svgs, svgsDefinitions },
    dimensions: talk.config.dimensions,
    isProduction: context.isProduction,
    isExporting: context.extensions.freya.export ?? false,
    pusher: pusherConfig
      ? {
          key: pusherConfig.key,
          cluster: pusherConfig.cluster,
          hostname: context.isProduction ? hostname() : undefined
        }
      : undefined,
    data,
    serverData
  }
}

export async function generateApplicationScript(
  context: BuildContext,
  clientContext: ClientContext,
  layoutsMap: Record<string, string>
): Promise<string> {
  const application = fileURLToPath(new URL('../components/application.js', import.meta.url))

  const layouts: string[] = []
  const imports = Object.entries(layoutsMap).map(([id, path]) => {
    layouts.push(`"${id}": ${id}Layout`)
    return `import { default as ${id}Layout } from "${path}"`
  })

  // Bundle with rollup
  const bundled = await rollup({
    input: application,
    plugins: [
      // @ts-expect-error Invalid handling of moduleResolution
      rollupReplace({
        preventAssignment: true,
        values: {
          __replace_placeholder_context__: JSON.stringify(clientContext, null, 2),
          __replace_placeholder_layouts__: `{${layouts.join(', ')}}`,
          __replace_placeholder_imports__: imports.join('\n')
        }
      }),
      // @ts-expect-error Invalid handling of moduleResolution
      rollupNodeResolve({
        browser: true,
        modulePaths: [fileURLToPath(new URL('../../../node_modules', import.meta.url))],
        preferBuiltins: true
      }),
      // @ts-expect-error Invalid handling of moduleResolution
      rollupCommonJs()
    ],
    output: {
      format: 'esm'
    },
    treeshake: true
  })

  const generated = await bundled.generate({ format: 'esm' })
  let code = generated.output[0].code

  // Eventually minify with swc
  if (context.isProduction) {
    const minified = await transform(code, { jsc: { target: 'es2022' }, minify: true })
    code = minified.code
  }

  return code
}

export function generatePage404(context: BuildContext): string {
  return render(page404(context, cleanCssClasses('freya@root', 'freya@page404__body')))
}

export async function generateAssetsListing(context: BuildContext): Promise<Record<string, string>> {
  const bodyClassName = cleanCssClasses('freya@root', 'freya@resources__body')

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
    const theme = await getTheme(talk.config.theme)

    const [commonImages, themeImages, talkImages] = await listThemeAndTalkImages(talk.config.theme, id)

    pages[id] = render(assetsPage({ context, theme, talk, commonImages, themeImages, talkImages, bodyClassName }))

    const progress = `[${i.toString().padStart(padding, '0')}/${totalPadded}]`
    context.logger.info(`${progress} Generated assets listing for slideset ${id} in ${elapsed(startTime)} ms.`)
  }

  return pages
}

export async function generateSlideset(context: BuildContext, theme: Theme, talk: Talk): Promise<string> {
  const [, pusher] = await resolvePusher()
  const clientContext = await prepareClientContext(context, theme, talk)
  const layouts: Record<string, string> = {}

  // Render the slides
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

    // Render the slide on the server to add the required classes
    const layoutPath = resolve(
      rootDir,
      baseTemporaryDirectory,
      'themes',
      talk.config.theme,
      'layouts',
      (slide.layout ?? 'default') + '.js'
    )

    const { default: layout }: { default: SlideRenderer } = await import(layoutPath)
    layouts[slide.layout ?? 'default'] = layoutPath

    render(
      SlideComponent({
        context: clientContext,
        layout,
        slide,
        index: i + 1,
        resolveImage: resolveImageUrl.bind(null, clientContext.assets.images),
        resolveSVG: resolveSVG.bind(null, clientContext.assets.svgsDefinitions, clientContext.assets.svgs),
        parseContent: parseContent.bind(null, clientContext.assets.content)
      })
    )

    /*
      When on the second slide (so presenter will eventually show prev and next),
      render the hidden UI elements to preload their classes.
    */
    if (i === 1) {
      render(
        Widgets({
          context: clientContext,
          layout,
          slide,
          index: i + 1,
          resolveImage: resolveImageUrl.bind(null, clientContext.assets.images),
          resolveSVG: resolveSVG.bind(null, clientContext.assets.svgsDefinitions, clientContext.assets.svgs),
          parseContent: parseContent.bind(null, clientContext.assets.content)
        })
      )
    }

    if (slide.notes) {
      parseContent(clientContext.assets.content, slide.notes)
    }
  }

  for (const image of Object.values(clientContext.assets.images)) {
    context.extensions.freya.images.add(image)
  }

  // Do not propagate the server data to the client
  clientContext.serverData = undefined

  // Render the page

  const [commonImages, themeImages, talkImages] = await listThemeAndTalkImages(theme.id, talk.id)

  const html = render(
    page({
      talk,
      theme,
      commonImages,
      themeImages,
      talkImages,
      js: await finalizeJs([await generateApplicationScript(context, clientContext, layouts), pusher].join('\n;\n')),
      title: talk.document.title,
      body: undefined,
      bodyClassName: cleanCssClasses('freya@root', 'freya@loading'),
      messageClassName: cleanCssClasses('freya@loading__text')
    })
  )

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
  slidesets.index = render(await index(context, resolvedTalks, cleanCssClasses('freya@root', 'freya@resources__body')))

  return slidesets
}
