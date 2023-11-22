import { elapsed, rootDir } from 'dante'
import { exec as execCB } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import type pino from 'pino'
import { chromium, type Browser } from 'playwright'
import { renderToStaticMarkup } from 'react-dom/server'
import waitOn from 'wait-on'
import { filterWhitelistedTalks } from './configuration.js'
import { getAllTalks, getTalk } from './slidesets/loaders.js'
import { type Talk } from './slidesets/models.js'
import { speakerNotes } from './templates/speaker-notes.js'

const exec = promisify(execCB)

async function exportNotes(
  logger: pino.Logger,
  talk: Talk,
  directory: string,
  filename: string,
  progress: string
): Promise<void> {
  if (!talk.slides.some(s => (s.notes ?? '').length > 0)) {
    return
  }

  const startTime = process.hrtime.bigint()

  await writeFile(resolve(directory, filename), renderToStaticMarkup(speakerNotes(talk)), 'utf8')
  logger.info(`${progress} Generated speaker notes for slideset ${talk.id} in ${elapsed(startTime)} ms.`)
}

export async function exportAsJPEGs(
  logger: pino.Logger,
  id: string,
  fullOutput: string,
  baseUrl: URL,
  browser: Browser,
  current: number,
  total: number
): Promise<void> {
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await context.newPage()
  const talk = await getTalk(id)

  // Resize the browser
  await page.setViewportSize(talk.config.dimensions)

  // Open the page and wait for it to be completely loaded
  await page.goto(new URL(`/${id}?export=true`, baseUrl).toString())
  await Promise.all([page.waitForLoadState('load')])
  await page.waitForSelector('[data-freya-id="loading"]', { state: 'detached' })

  await mkdir(resolve(fullOutput, id))

  // Now make a screenshot of the entire page
  await page.screenshot({
    path: resolve(fullOutput, id, 'all.jpg'),
    clip: {
      x: 0,
      y: 0,
      width: talk.config.dimensions.width,
      height: talk.config.dimensions.height * talk.slides.length
    },
    fullPage: true,
    type: 'jpeg',
    quality: 100
  })

  // Split the images using imagemagick
  await exec(
    `convert all.jpg -crop ${talk.config.dimensions.width}x${talk.config.dimensions.height} +repage %02d.jpg`,
    { cwd: resolve(fullOutput, id) }
  )

  await rm(resolve(fullOutput, id, 'all.jpg'))

  const totalPadding = total.toString().length
  const progress = `[${current.toString().padStart(totalPadding, '0')}/${total}]`
  const startTime = process.hrtime.bigint()

  logger.info(`${progress} Generated files for slideset ${id} in ${elapsed(startTime)} ms.`)

  await exportNotes(logger, talk, fullOutput, join(id, 'speaker-notes.html'), progress)
}

export async function createPDF(
  logger: pino.Logger,
  id: string,
  staticDir: string,
  current: number,
  total: number
): Promise<void> {
  const totalPadding = total.toString().length
  const progress = `[${current.toString().padStart(totalPadding, '0')}/${total}]`
  const startTime = process.hrtime.bigint()

  try {
    await exec(`magick *.jpg ../../pdf/${id}.pdf`, { cwd: resolve(rootDir, staticDir, 'jpeg', id) })
  } catch (error) {
    logger.fatal({ e: error }, 'Creating PDF failed.')
    process.exit(1)
  }

  const notesPath = resolve(rootDir, staticDir, 'jpeg', id, 'speaker-notes.html')
  if (existsSync(notesPath)) {
    await cp(notesPath, resolve(rootDir, staticDir, 'pdf', `${id}-speaker-notes.html`))
  }

  logger.info(`${progress} Created PDF for slideset ${id} in ${elapsed(startTime)} ms.`)
}

export async function exportAllAsJPEGs(logger: pino.Logger, staticDir: string, port: number): Promise<void> {
  try {
    await exec('magick --help')
    await exec('convert --help')
  } catch (e) {
    throw new Error(
      'The magick or convert utilities could not be executed. Please make sure you have imagemagick installed.'
    )
  }

  const operationStart = process.hrtime.bigint()

  const fullOutput = resolve(rootDir, staticDir, 'jpeg')
  const protocol = existsSync(resolve(rootDir, 'ssl')) ? 'https' : 'http'
  const baseUrl = new URL(`${protocol}://127.0.0.1:${port}`)

  logger.info(`Exporting JPEG files into directory ${staticDir}/jpeg ...`)

  // Prepare the output directory
  await rm(fullOutput, { recursive: true, force: true })
  await mkdir(fullOutput, { recursive: true })

  // Await for the website to be reachable
  await waitOn({ resources: [`tcp:127.0.0.1:${port}`], timeout: 30_000 })

  const browser = await chromium.launch({ headless: !(process.env.FREYA_DEBUG_EXPORT === 'true') })
  const talks = filterWhitelistedTalks(await getAllTalks())

  const talksArray = [...talks]
  const talksArrayLength = talksArray.length
  for (let i = 0; i < talksArrayLength; i++) {
    await exportAsJPEGs(logger, talksArray[i], fullOutput, baseUrl, browser, i + 1, talksArrayLength)
  }

  await browser.close()

  logger.info(`Exporting completed in ${elapsed(operationStart)} ms.`)
}

export async function createAllPDFs(logger: pino.Logger, staticDir: string): Promise<void> {
  const operationStart = process.hrtime.bigint()

  logger.info(`Creating PDF files into directory ${staticDir}/pdfs ...`)

  // Prepare the output directory
  await rm(resolve(rootDir, staticDir, 'pdf'), { recursive: true, force: true })
  await mkdir(resolve(rootDir, staticDir, 'pdf'), { recursive: true })

  const talks = filterWhitelistedTalks(await getAllTalks())

  const talksArray = [...talks]
  const talksArrayLength = talksArray.length
  for (let i = 0; i < talksArrayLength; i++) {
    await createPDF(logger, talksArray[i], staticDir, i + 1, talksArrayLength)
  }

  logger.info(`Created all PDF files in ${elapsed(operationStart)} ms.`)
}
