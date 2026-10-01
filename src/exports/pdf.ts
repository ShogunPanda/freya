import type { BuildContext } from '@perseveranza-pets/dante'
import type { Command } from 'commander'
import type pino from 'pino'
import type { Browser, CDPSession, Page } from 'playwright'
import type { Talk } from '../slidesets/models.ts'
import { createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, relative, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createBuildContext, loadFontsFile, finalizePageCSS, rootDir } from '@perseveranza-pets/dante'
import PDFDocument from 'pdfkit'
import { chromium } from 'playwright'
import { filterWhitelistedTalks, setWhitelistedTalks } from '../configuration.ts'
import { css, cssVisitor } from '../css.ts'
import { getAllTalks, getTalk } from '../slidesets/loaders.ts'
import { ExportCache } from './cache.ts'
import { generateAllSlidesets } from './html.ts'

export async function performPDF(command: Command, logger: pino.Logger): Promise<string[]> {
  const { directory: staticDir, only, concurrency = 3, scale = 2, force = false } = command.optsWithGlobals()
  setWhitelistedTalks(only)
  const absoluteStaticDir = resolve(rootDir, staticDir)
  const context = createBuildContext(logger, true, absoluteStaticDir)
  context.extensions.freya = {
    export: true,
    exportingFormat: 'pdf',
    fonts: await loadFontsFile(fileURLToPath(new URL('../assets/styles/fonts.yml', import.meta.url)))
  }
  const output = resolve(absoluteStaticDir, 'pdf')
  const relativeOutput = relative(process.cwd(), output)
  logger.info(`Exporting PDFs into ${relativeOutput.startsWith('..') ? relativeOutput : `./${relativeOutput}`} ...`)
  return exportPDFs(context, output, concurrency, scale, force)
}

async function build(context: BuildContext, talks?: Set<string>): Promise<void> {
  const baseDir = context.root
  await rm(baseDir, { force: true, recursive: true })
  await mkdir(baseDir, { recursive: true })

  context.extensions.freya.images = new Set()
  context.extensions.freya.talks = talks ?? filterWhitelistedTalks(context, await getAllTalks())
  context.logger.info(`Exporting slideset(s): ${[...context.extensions.freya.talks].join(', ')}`)
  context.logger.info('Preparing slidesets ...')
  const preparationStart = performance.now()

  const styles = new Map<string, string>()
  await generateAllSlidesets(context, async slides => {
    for (const [name, html] of Object.entries(slides)) {
      const key = name.endsWith('/speaker-notes.html') ? 'notes' : `talk:${dirname(name)}`
      let compiledHead = styles.get(key)
      if (compiledHead === undefined) {
        const pageContext = { ...context, currentPage: resolve(baseDir, name) }
        // Dante transforms CSS independently of HTML; reuse its compiled style for the entire talk.
        compiledHead = finalizePageCSS(pageContext, '</head>', await css(pageContext), cssVisitor)
        styles.set(key, compiledHead)
      }
      slides[name] = html.replace('</head>', compiledHead)
    }
    const directories = await Promise.allSettled(
      [...new Set(Object.keys(slides).map(dirname))].map(directory => {
        return mkdir(resolve(baseDir, directory), { recursive: true })
      })
    )
    const directoryError = directories.find(result => result.status === 'rejected')
    if (directoryError?.status === 'rejected') {
      throw directoryError.reason
    }
    // Wait for all writes before cleanup can remove the temporary directory.
    const writes = await Promise.allSettled(
      Object.entries(slides).map(async ([name, content]) => {
        await writeFile(resolve(baseDir, name), content, 'utf-8')
      })
    )
    const writeError = writes.find(result => result.status === 'rejected')
    if (writeError?.status === 'rejected') {
      throw writeError.reason
    }
  })
  context.logger.info(`Preparation completed in ${(performance.now() - preparationStart).toFixed(2)}ms.`)
}

/** Runs in Chromium; wait for decoded images and fonts rather than network-idle heuristics. */
async function prepareSlide(): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    // Freeze animations and hide carets before capturing the slide.
    const style = document.createElement('style')
    style.textContent = '* { caret-color: transparent !important; }'
    document.head.append(style)
    for (const animation of document.getAnimations()) {
      const endTime = animation.effect?.getComputedTiming().endTime
      if (typeof endTime === 'number' && Number.isFinite(endTime)) {
        if (animation.playbackRate === 0) {
          animation.currentTime = endTime
        } else {
          animation.finish()
        }
      } else {
        animation.cancel()
      }
    }

    const fonts: Promise<unknown>[] = []
    const images: Promise<unknown>[] = []
    document.fonts.forEach(font => {
      fonts.push(
        font.load().catch(error => {
          throw new Error(`Loading font ${font.family} (${font.style} ${font.weight}) failed: ${error}`)
        })
      )
    })

    for (const image of Array.from(document.querySelectorAll('img'))) {
      image.loading = 'eager'
      if (image.currentSrc || image.src) {
        images.push(
          image.decode().catch(error => {
            throw new Error(`Decoding image ${image.currentSrc || image.src} failed: ${error}`)
          })
        )
      }
    }

    const urls = new Set<string>()
    for (const element of Array.from(document.querySelectorAll('*'))) {
      for (const pseudo of [null, '::before', '::after']) {
        const style = getComputedStyle(element, pseudo)
        for (const value of [style.backgroundImage, style.maskImage, style.borderImageSource, style.content]) {
          for (const match of value.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/g)) {
            urls.add(match[1] ?? match[2] ?? match[3].trim())
          }
        }
      }
    }
    for (const image of Array.from(document.querySelectorAll('image'))) {
      if (image.href.baseVal) {
        urls.add(new URL(image.href.baseVal, document.baseURI).href)
      }
    }
    for (const url of urls) {
      // SVG masks can reference definitions in this document rather than an image file.
      const reference = new URL(url, document.baseURI)
      if (reference.hash && reference.href.slice(0, -reference.hash.length) === document.URL.split('#')[0]) {
        continue
      }
      const image = new Image()
      image.src = url
      images.push(
        image.decode().catch(error => {
          throw new Error(`Decoding CSS or SVG image ${url} failed: ${error}`)
        })
      )
    }

    await Promise.race([
      Promise.all([...fonts, ...images]),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Waiting for slide fonts and images timed out.')), 30000)
      })
    ])
  } finally {
    clearTimeout(timeout)
  }
}

async function captureJPEG(page: Page, session: CDPSession, scale: number): Promise<Buffer> {
  const viewport = page.viewportSize()!
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const { data } = await Promise.race([
      session.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 95,
        fromSurface: true,
        captureBeyondViewport: false,
        // CDP needs an explicit clip scale to output the requested pixel density.
        clip: { x: 0, y: 0, ...viewport, scale },
        optimizeForSpeed: true
      }),
      new Promise<never>((_resolve, reject) => {
        // CDP commands do not inherit Playwright's default operation timeout.
        timeout = setTimeout(() => reject(new Error('Capturing the slide through CDP timed out.')), 30000)
      })
    ])
    return Buffer.from(data, 'base64')
  } finally {
    clearTimeout(timeout)
  }
}

async function assemblePDF(talk: Talk, images: string, staging: string, output: string): Promise<void> {
  const temporaryPDF = resolve(staging, `${talk.id}.pdf`)
  const destination = resolve(output, `${talk.id}.pdf`)
  await mkdir(dirname(temporaryPDF), { recursive: true })
  await mkdir(dirname(destination), { recursive: true })
  const document = new PDFDocument({ autoFirstPage: false, info: { Title: talk.document.title } })
  const completion = pipeline(document, createWriteStream(temporaryPDF, { flags: 'wx' }))
  // Observe stream failures immediately, including while an image is being read.
  completion.catch(() => {})
  try {
    const { width, height } = talk.config.dimensions
    for (let slide = 1; slide <= talk.slidesCount; slide++) {
      const name = slide.toString().padStart(talk.slidesPadding, '0')
      const jpeg = await readFile(resolve(images, `${name}.jpg`))
      // Use buffers to avoid PDFKit's filename cache retaining every image in a talk.
      document.addPage({ size: [width, height], margin: 0 })
      // Embed the captured JPEG directly, without another lossy encoding pass.
      document.image(jpeg, 0, 0, { width, height })
    }
    document.end()
    await completion
    // Staging is on the destination filesystem, so replacement is atomic.
    await rename(temporaryPDF, destination)
  } catch (error) {
    document.destroy()
    await completion.catch(() => {})
    throw new Error(`Creating PDF for slideset "${talk.id}" failed.`, { cause: error })
  }
}

async function renderPDFs(
  context: BuildContext,
  destination: string,
  concurrency: number,
  scale: number
): Promise<string[]> {
  const exported: string[] = []
  const output = resolve(dirname(context.root), 'jpegs')
  if (output === context.root) {
    throw new Error('HTML and JPEG output directories must be different.')
  }

  const talks = await Promise.all([...(context.extensions.freya.talks as Set<string>)].map(id => getTalk(id)))
  await rm(output, { recursive: true, force: true })
  await mkdir(output, { recursive: true })
  const browserCount = Math.min(concurrency, talks.length)
  const tabCount = Math.min(concurrency, Math.max(0, ...talks.map(talk => talk.slidesCount)))
  if (!tabCount) {
    return exported
  }

  const browsers: Browser[] = []
  let closeFailure: PromiseRejectedResult | undefined
  try {
    // Settle all startups before cleanup so a late browser cannot escape the pool.
    const startups = await Promise.allSettled(
      Array.from({ length: browserCount }, async (_, index) => {
        const browser = await chromium.launch({
          headless: process.env.FREYA_DEBUG_EXPORT !== 'true',
          args: ['--use-gl=egl']
        })
        browsers[index] = browser
        const browserContext = await browser.newContext({ ignoreHTTPSErrors: true, deviceScaleFactor: scale })
        browserContext.setDefaultTimeout(30000)
        const pages = await Promise.all(Array.from({ length: tabCount }, () => browserContext.newPage()))
        const sessions = await Promise.all(pages.map(page => browserContext.newCDPSession(page)))
        return { pages, sessions }
      })
    )
    const startupError = startups.find(result => result.status === 'rejected')
    if (startupError?.status === 'rejected') {
      throw startupError.reason
    }
    const workers = startups.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []))
    let nextTalk = 0
    let completedTalks = 0
    let stopped = false

    async function renderTalk(talk: Talk, { pages, sessions }: (typeof workers)[number]): Promise<void> {
      const start = performance.now()
      await mkdir(resolve(output, talk.id), { recursive: true })
      let nextSlide = 0
      let failed = false
      const results = await Promise.allSettled(
        pages.slice(0, talk.slidesCount).map(async (page, tabIndex) => {
          try {
            await page.setViewportSize(talk.config.dimensions)
            while (nextSlide < talk.slidesCount) {
              if (failed) {
                break
              }
              const slide = ++nextSlide
              const name = slide.toString().padStart(talk.slidesPadding, '0')
              try {
                await page.goto(pathToFileURL(resolve(context.root, talk.id, `${name}.html`)).href)
                await page.evaluate(prepareSlide)
                const jpeg = await captureJPEG(page, sessions[tabIndex], scale)
                await writeFile(resolve(output, talk.id, `${name}.jpg`), jpeg)
              } catch (error) {
                throw new Error(`Rendering slideset "${talk.id}", slide ${slide} failed.`, { cause: error })
              }
            }
          } catch (error) {
            failed = true
            throw error
          }
        })
      )
      const error = results.find(result => result.status === 'rejected')
      if (error?.status === 'rejected') {
        throw error.reason
      }

      if (talk.slidesCount > 0) {
        await assemblePDF(talk, resolve(output, talk.id), resolve(dirname(context.root), 'pdf'), destination)
        exported.push(talk.id)
      }
      await rm(resolve(output, talk.id), { recursive: true, force: true })
      await rm(resolve(context.root, talk.id), { recursive: true, force: true })

      // Finish assembly and release intermediates before taking another talk.
      completedTalks++
      context.logger.info(
        `[${completedTalks}/${talks.length}] Slideset ${talk.id} with ${talk.slidesCount} slides exported in ${(performance.now() - start).toFixed(2)}ms.`
      )
    }

    const workerResults = await Promise.allSettled(
      workers.map(async worker => {
        try {
          while (nextTalk < talks.length) {
            if (stopped) {
              break
            }
            const talk = talks[nextTalk++]
            await renderTalk(talk, worker)
          }
        } catch (error) {
          stopped = true
          throw error
        }
      })
    )
    const workerError = workerResults.find(result => result.status === 'rejected')
    if (workerError?.status === 'rejected') {
      throw workerError.reason
    }
  } finally {
    // Settle every close and preserve any original rendering error.
    const closures = await Promise.allSettled(browsers.map(browser => browser.close()))
    closeFailure = closures.find(result => result.status === 'rejected')
    if (closeFailure) {
      context.logger.error(closeFailure.reason, 'Closing a rendering browser failed.')
    }
  }
  if (closeFailure) {
    throw closeFailure.reason
  }
  return exported
}

export async function exportPDFs(
  context: BuildContext,
  output: string,
  concurrency: number,
  scale: number,
  force: boolean = false
): Promise<string[]> {
  const start = performance.now()
  await mkdir(output, { recursive: true })
  const selected = filterWhitelistedTalks(context, await getAllTalks())
  const require = createRequire(import.meta.url)
  // Library implementation changes invalidate exports only when their package versions change.
  const versions: Record<string, string> = {}
  const packages = {
    freya: fileURLToPath(new URL('../../package.json', import.meta.url)),
    dante: resolve(dirname(require.resolve('@perseveranza-pets/dante')), '../package.json'),
    pdfkit: resolve(dirname(require.resolve('pdfkit')), '../package.json'),
    playwright: require.resolve('playwright/package.json')
  }
  for (const [name, path] of Object.entries(packages)) {
    versions[name] = JSON.parse(await readFile(path, 'utf8')).version
  }
  const cache = await ExportCache.open(rootDir, output, 'pdf', {
    buildVersion: process.env.FREYA_BUILD_VERSION ?? process.env.DANTE_BUILD_VERSION,
    versions,
    scale,
    jpegQuality: 95,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })
  const reused: string[] = []
  // Resolve cache hits before preparation so its listing and progress count only pending talks.
  const pending = new Set<string>()
  for (const id of selected) {
    const matches = await cache.matches(id)
    if (!force && matches) {
      reused.push(id)
      context.logger.info(
        `[${String(reused.length + pending.size).padStart(String(selected.size).length, '0')}/${selected.size}] Skipping exporting of slideset ${id} as contents have not changed.`
      )
    } else {
      pending.add(id)
    }
  }
  if (!pending.size) {
    context.logger.info(`Reused ${reused.length} PDFs in ${(performance.now() - start).toFixed(2)}ms.`)
    return reused
  }
  // Keep each run isolated and on the output filesystem for atomic PDF publication.
  const temporary = await mkdtemp(resolve(output, '.freya-pdf-'))
  const originalRoot = context.root
  let exported: string[]
  try {
    context.root = resolve(temporary, 'html')
    await build(context, pending)
    context.logger.info('Exporting slidesets ...')
    exported = await renderPDFs(context, output, concurrency, scale)
    for (const id of exported) {
      await cache.record(id)
    }
    await cache.save(temporary)
  } finally {
    context.root = originalRoot
    await rm(temporary, { recursive: true, force: true })
  }
  context.logger.info(`Exporting completed in ${(performance.now() - start).toFixed(2)}ms.`)
  return [...reused, ...exported]
}
