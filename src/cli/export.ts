import { createCanvas, Image } from 'canvas'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import pino, { BaseLogger } from 'pino'
import { Browser, chromium, Page } from 'playwright'
import { renderToStaticMarkup } from 'react-dom/server'
import waitOn from 'wait-on'
import { elapsedTime } from '../generation/generator.js'
import { getTalk, getTalks, rootDir } from '../generation/loader.js'
import { Talk } from '../generation/models.js'
import { speakerNotes } from '../templates/speaker-notes.js'

interface ExportContext {
  fullOutput: string
  baseUrl: URL
  logger: pino.BaseLogger
  browser: Browser
  page: Page
  talks: Set<string>
}

async function prepareExport(port: number, output: string): Promise<ExportContext> {
  const fullOutput = resolve(rootDir, output)
  const baseUrl = new URL(`http://127.0.0.1:${port}`)

  const logger = pino({ transport: { target: 'pino-pretty' } })
  logger.info(`Exporting into directory ${output} ...`)

  // Prepare the output directory
  await rm(fullOutput, { recursive: true, force: true })
  await mkdir(fullOutput, { recursive: true })

  // Await for the website to be reachable
  await waitOn({ resources: [`tcp:127.0.0.1:${port}`], timeout: 30_000 })

  // Generate each talk
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const talks = await getTalks()

  return {
    fullOutput,
    baseUrl,
    logger,
    browser,
    page,
    talks
  }
}

async function exportNotes(logger: BaseLogger, talk: Talk, directory: string, filename: string): Promise<void> {
  if (!talk.slides.some(s => (s.notes ?? '').length > 0)) {
    return
  }

  const startTime = process.hrtime.bigint()

  await writeFile(resolve(directory, filename), renderToStaticMarkup(speakerNotes(talk)), 'utf8')
  logger.info(`Generated file ${filename} in ${elapsedTime(startTime)} ms ...`)
}

export async function exportJPEGs(port: number, output: string): Promise<void> {
  const { fullOutput, baseUrl, logger, browser, page, talks } = await prepareExport(port, output)

  for (const id of talks) {
    const talk = await getTalk(id)

    // Resize the browser
    await page.setViewportSize(talk.config.dimensions)

    // Open the page and wait for it to be completely loaded
    await page.goto(new URL(`/${id}`, baseUrl).toString())
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

      logger.info(`Generated file ${filename} in ${elapsedTime(startTime)} ms ...`)

      // Go the next slide
      await page.press('body', 'Enter')
    }

    await exportNotes(logger, talk, fullOutput, join(id, 'speaker-notes.html'))
  }

  await browser.close()
}

export async function exportPDFs(port: number, output: string): Promise<void> {
  const { fullOutput, baseUrl, logger, browser, page, talks } = await prepareExport(port, output)

  for (const id of talks) {
    const startTime = process.hrtime.bigint()
    const talk = await getTalk(id)

    // Resize the browser
    await page.setViewportSize(talk.config.dimensions)

    // Open the page and wait for it to be completely loaded
    await page.goto(new URL(`/${id}`, baseUrl).toString())
    await Promise.all([page.waitForLoadState('load'), page.waitForLoadState('networkidle')])
    await page.waitForSelector('[data-freya-id="loading"]', { state: 'detached' })

    const canvas = createCanvas(talk.config.dimensions.width, talk.config.dimensions.height, 'pdf')
    const ctx = canvas.getContext('2d')
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
      await page.press('body', 'Enter')
    }

    await writeFile(resolve(fullOutput, `${id}.pdf`), canvas.toBuffer())

    logger.info(`Generated file ${id}.pdf in ${elapsedTime(startTime)} ms ...`)

    await exportNotes(logger, talk, fullOutput, `${id}-speaker-notes.html`)
  }

  await browser.close()
}
