import { createCanvas, Image } from 'canvas'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import pino, { type BaseLogger } from 'pino'
import { type Browser, chromium } from 'playwright'
import { renderToStaticMarkup } from 'react-dom/server'
import waitOn from 'wait-on'
import { elapsedTime } from '../generation/generator.js'
import { getTalk, getTalks, rootDir } from '../generation/loader.js'
import { type Talk } from '../generation/models.js'
import { speakerNotes } from '../templates/speaker-notes.js'
import { filterWhitelistedTalks } from './builders.js'

interface ExportContext {
  fullOutput: string
  baseUrl: URL
  logger: pino.BaseLogger
  browser: Browser
  talks: Set<string>
}

async function prepareExport(type: string, port: number, output: string): Promise<ExportContext> {
  const fullOutput = resolve(rootDir, output)
  const baseUrl = new URL(`http://127.0.0.1:${port}`)

  const logger = pino({ transport: { target: 'pino-pretty' }, level: process.env.LOG_LEVEL ?? 'info' })
  logger.info(`Exporting ${type} files into directory ${output} ...`)

  // Prepare the output directory
  await rm(fullOutput, { recursive: true, force: true })
  await mkdir(fullOutput, { recursive: true })

  // Await for the website to be reachable
  await waitOn({ resources: [`tcp:127.0.0.1:${port}`], timeout: 30_000 })

  // Generate each talk
  const browser = await chromium.launch()
  const talks = filterWhitelistedTalks(await getTalks())

  return {
    fullOutput,
    baseUrl,
    logger,
    browser,
    talks
  }
}

async function exportNotes(logger: BaseLogger, talk: Talk, directory: string, filename: string): Promise<void> {
  if (!talk.slides.some(s => (s.notes ?? '').length > 0)) {
    return
  }

  const startTime = process.hrtime.bigint()

  await writeFile(resolve(directory, filename), renderToStaticMarkup(speakerNotes(talk)), 'utf8')
  logger.info(`Generated file ${filename} in ${elapsedTime(startTime)} ms.`)
}

export async function exportAsJPEGs(
  logger: BaseLogger,
  id: string,
  fullOutput: string,
  baseUrl: URL,
  browser: Browser,
  skipSpeakerNotes: boolean = false
): Promise<void> {
  const page = await browser.newPage()
  const talk = await getTalk(id, logger)

  // Resize the browser
  await page.setViewportSize(talk.config.dimensions)

  // Open the page and wait for it to be completely loaded
  await page.goto(new URL(`/${id}?export=true`, baseUrl).toString())
  await Promise.all([page.waitForLoadState('load'), page.waitForLoadState('networkidle')])
  await page.waitForSelector('[data-freya-id="loading"]', { state: 'detached' })

  await mkdir(resolve(fullOutput, id))
  for (let i = 1; i <= talk.slides.length; i++) {
    const startTime = process.hrtime.bigint()
    const paddedSlide = i.toString().padStart(talk.slidesPadding, '0')
    const filename = join(id, paddedSlide + '.jpg')

    await page.waitForURL(new URL(`/${id}/${paddedSlide}`, baseUrl).toString())
    await page.screenshot({
      path: resolve(fullOutput, filename),
      clip: {
        x: 0,
        y: 0,
        ...talk.config.dimensions
      },
      type: 'jpeg',
      quality: 100
    })

    logger.info(`Generated file ${filename} in ${elapsedTime(startTime)} ms.`)

    // Go the next slide
    await page.press('body', 'ArrowRight')
  }

  if (!skipSpeakerNotes) {
    await exportNotes(logger, talk, fullOutput, join(id, 'speaker-notes.html'))
  }
}

export async function exportAsPDF(
  logger: BaseLogger,
  id: string,
  fullOutput: string,
  baseUrl: URL,
  browser: Browser,
  skipSpeakerNotes: boolean = false
): Promise<void> {
  const page = await browser.newPage()
  const talk = await getTalk(id, logger)

  // Resize the browser
  await page.setViewportSize(talk.config.dimensions)

  // Open the page and wait for it to be completely loaded
  await page.goto(new URL(`/${id}?export=true`, baseUrl).toString())
  await Promise.all([page.waitForLoadState('load'), page.waitForLoadState('networkidle')])
  await page.waitForSelector('[data-freya-id="loading"]', { state: 'detached' })

  const canvas = createCanvas(talk.config.dimensions.width, talk.config.dimensions.height, 'pdf')
  const ctx = canvas.getContext('2d')
  const startTime = process.hrtime.bigint()
  for (let i = 1; i <= talk.slides.length; i++) {
    if (i > 1) {
      canvas.getContext('2d').addPage()
    }

    const paddedSlide = i.toString().padStart(talk.slidesPadding, '0')

    await page.waitForURL(new URL(`/${id}/${paddedSlide}`, baseUrl).toString())

    const image = new Image()
    image.dataMode = Image.MODE_MIME
    image.src = await page.screenshot({
      clip: {
        x: 0,
        y: 0,
        ...talk.config.dimensions
      },
      quality: 100,
      type: 'jpeg'
    })

    ctx.drawImage(image, 0, 0)

    // Go the next slide
    await page.press('body', 'ArrowRight')
  }

  await writeFile(resolve(fullOutput, `${id}.pdf`), canvas.toBuffer())

  logger.info(`Generated file ${id}.pdf in ${elapsedTime(startTime)} ms.`)

  if (!skipSpeakerNotes) {
    await exportNotes(logger, talk, fullOutput, `${id}-speaker-notes.html`)
  }
}

export async function exportAllAsJPEGs(
  port: number,
  output: string = 'dist/jpeg',
  skipSpeakerNotes: boolean = false
): Promise<void> {
  const { fullOutput, baseUrl, logger, browser, talks } = await prepareExport('JPEGs', port, output)

  await Promise.all([...talks].map(id => exportAsJPEGs(logger, id, fullOutput, baseUrl, browser, skipSpeakerNotes)))

  await browser.close()
}

export async function exportAllAsPDFs(
  port: number,
  output: string = 'dist/pdf',
  skipSpeakerNotes: boolean = false
): Promise<void> {
  const { fullOutput, baseUrl, logger, browser, talks } = await prepareExport('PDFs', port, output)

  await Promise.all([...talks].map(id => exportAsPDF(logger, id, fullOutput, baseUrl, browser, skipSpeakerNotes)))

  await browser.close()
}
