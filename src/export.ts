import { elapsed, rootDir } from 'dante'
import { exec as execCB } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import type pino from 'pino'
import { chromium } from 'playwright'
import { renderToStaticMarkup } from 'react-dom/server'
import waitOn from 'wait-on'
import { filterWhitelistedTalks } from './configuration.js'
import { getAllTalks, getTalk } from './slidesets/loaders.js'
import { type Talk } from './slidesets/models.js'
import { speakerNotes } from './templates/speaker-notes.js'

interface Progress {
  current: number
  total: number
  padding: number
}

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

export async function exportAsPNGs(
  logger: pino.Logger,
  id: string,
  fullOutput: string,
  baseUrl: URL,
  progress: Progress
): Promise<void> {
  const browser = await chromium.launch({
    headless: !(process.env.FREYA_DEBUG_EXPORT === 'true'),
    args: ['--use-gl=egl']
  })
  const startTime = process.hrtime.bigint()
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await context.newPage()
  const talk = await getTalk(id)

  // Resize the browser
  await page.setViewportSize(talk.config.dimensions)

  // Open the page and wait for it to be completely loaded
  await mkdir(resolve(fullOutput, id))

  for (let i = 0; i < talk.slidesCount; i++) {
    const paddedSlide = i.toString().padStart(talk.slidesPadding, '0')

    await page.goto(new URL(`/${id}/${paddedSlide}?export=true`, baseUrl).toString())
    await Promise.all([page.waitForLoadState('load')])

    // Now make a screenshot of the entire page
    await page.screenshot({
      path: resolve(fullOutput, id, paddedSlide + '.png'),
      clip: {
        x: 0,
        y: 0,
        width: talk.config.dimensions.width,
        height: talk.config.dimensions.height
      },
      fullPage: true,
      type: 'png'
    })
  }

  await browser.close()

  progress.current++
  const progressString = `[${progress.current.toString().padStart(progress.padding, '0')}/${progress.total}]`

  logger.info(`${progressString} Generated files for slideset ${id} in ${elapsed(startTime)} ms.`)

  await exportNotes(logger, talk, fullOutput, join(id, 'speaker-notes.html'), progressString)
}

export async function createPDF(logger: pino.Logger, id: string, staticDir: string, progress: Progress): Promise<void> {
  const startTime = process.hrtime.bigint()

  try {
    await exec(`magick *.png ../../pdf/${id}.pdf`, { cwd: resolve(rootDir, staticDir, 'png', id) })
  } catch (error) {
    logger.fatal({ e: error }, 'Creating PDF failed.')
    process.exit(1)
  }

  const notesPath = resolve(rootDir, staticDir, 'png', id, 'speaker-notes.html')
  if (existsSync(notesPath)) {
    await cp(notesPath, resolve(rootDir, staticDir, 'pdf', `${id}-speaker-notes.html`))
  }

  progress.current++
  const progressString = `[${progress.current.toString().padStart(progress.padding, '0')}/${progress.total}]`
  logger.info(`${progressString} Created PDF for slideset ${id} in ${elapsed(startTime)} ms.`)
}

export async function exportAllAsPNGs(logger: pino.Logger, staticDir: string, port: number): Promise<void> {
  try {
    await exec('magick --help')
    await exec('convert --help')
  } catch (e) {
    throw new Error(
      'The magick or convert utilities could not be executed. Please make sure you have imagemagick installed.'
    )
  }

  const operationStart = process.hrtime.bigint()

  const fullOutput = resolve(rootDir, staticDir, 'png')
  const protocol = existsSync(resolve(rootDir, 'ssl')) ? 'https' : 'http'
  const baseUrl = new URL(`${protocol}://127.0.0.1:${port}`)

  logger.info(`Exporting PNG files into directory ${staticDir}/png ...`)

  // Prepare the output directory
  await rm(fullOutput, { recursive: true, force: true })
  await mkdir(fullOutput, { recursive: true })

  // Await for the website to be reachable
  await waitOn({ resources: [`tcp:127.0.0.1:${port}`], timeout: 30_000 })

  const talks = filterWhitelistedTalks(await getAllTalks())

  const talksArray = [...talks]
  const talksArrayLength = talksArray.length
  const progress = {
    current: 0,
    total: talksArrayLength,
    padding: talksArrayLength.toString().length
  }

  await Promise.all(talksArray.map(t => exportAsPNGs(logger, t, fullOutput, baseUrl, progress)))

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
  const progress = {
    current: 0,
    total: talksArrayLength,
    padding: talksArrayLength.toString().length
  }

  await Promise.all(talksArray.map(t => createPDF(logger, t, staticDir, progress)))

  logger.info(`Created all PDF files in ${elapsed(operationStart)} ms.`)
}
