import type { BuildContext, BuildResult } from '@perseveranza-pets/dante'
import type { SlideRenderer, Talk } from './slidesets/models.ts'
import { exec as execCB } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { cleanCssClasses, elapsed, rootDir } from '@perseveranza-pets/dante'
import { glob } from 'glob'
import { chromium } from 'playwright'
import { render } from 'preact-render-to-string'
import { SvgDefinitions } from './client.ts'
import { filterWhitelistedTalks } from './configuration.ts'
import { css, cssVisitor } from './css.ts'
import { resolveSVG } from './rendering/svg.tsx'
import { listThemeAndTalkImages, parseContent, prepareClientContext } from './slidesets/generators.tsx'
import { getAllTalks, getTalk, getTheme } from './slidesets/loaders.ts'
import { page } from './templates/page.tsx'
import { SlideComponent } from './templates/slide.tsx'
import { body as speakerNotesBody, page as speakerNotesPage } from './templates/speaker-notes.tsx'

interface Progress {
  current: number
  total: number
  padding: number
}

const exec = promisify(execCB)

function slideTemporaryFileName(talk: Talk, index: number): string {
  return `${talk.id}--${(index + 1).toString().padStart(talk.slidesPadding, '0')}.html`
}

function slideTemporaryNotesName(talk: Talk): string {
  return `${talk.id}--notes.html`
}

function resolveImageUrl(cache: Record<string, string>, theme: string, talk: string, url?: string): string {
  url = url?.toString()
  const key = `${theme}:${talk}:${url}`

  if (!url) {
    return ''
  } else if (cache[key]) {
    return cache[key]
  }

  cache[key] = url
    .replace('@common', './assets/themes/common')
    .replace('@theme', `./assets/themes/${theme}`)
    .replace('@talk', `./assets/talks/${talk}`)
  return cache[key]
}

export async function ensureMagick(): Promise<void> {
  try {
    await exec('magick --help')
    await exec('convert --help')
  } catch (e) {
    throw new Error(
      'The magick or convert utilities could not be executed. Please make sure you have imagemagick installed.'
    )
  }
}

export async function exportAsPNGs(
  context: BuildContext,
  id: string,
  sourceDir: string,
  fullOutput: string,
  progress: Progress
): Promise<void> {
  const browser = await chromium.launch({
    headless: !(process.env.FREYA_DEBUG_EXPORT === 'true'),
    args: ['--use-gl=egl']
  })
  const startTime = process.hrtime.bigint()
  const browserContext = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await browserContext.newPage()
  const talk = await getTalk(id)

  // Resize the browser
  await page.setViewportSize(talk.config.dimensions)

  // Open the page and wait for it to be completely loaded
  await mkdir(resolve(fullOutput, id))

  for (let i = 0; i < talk.slidesCount; i++) {
    const paddedSlide = i.toString().padStart(talk.slidesPadding, '0')

    await page.goto(pathToFileURL(resolve(sourceDir, slideTemporaryFileName(talk, i))).toString())

    // Only for the first slide, wait for all images to be preloaded
    if (i === 0) {
      await page.waitForLoadState('networkidle')
    }

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

  const notesPath = resolve(sourceDir, slideTemporaryNotesName(talk))

  if (existsSync(notesPath)) {
    await cp(notesPath, resolve(rootDir, fullOutput, id, 'speaker-notes.html'))
  }

  context.logger.info(`${progressString} Generated files for slideset ${id} in ${elapsed(startTime)} ms.`)
}

export async function createPDF(
  context: BuildContext,
  id: string,
  staticDir: string,
  progress: Progress
): Promise<void> {
  const startTime = process.hrtime.bigint()

  try {
    await exec(`magick *.png ../../pdf/${id}.pdf`, { cwd: resolve(rootDir, staticDir, 'png', id) })
  } catch (error) {
    context.logger.fatal({ e: error }, 'Creating PDF failed.')
    process.exit(1)
  }

  const notesPath = resolve(rootDir, staticDir, 'png', id, 'speaker-notes.html')
  if (existsSync(notesPath)) {
    await cp(notesPath, resolve(rootDir, staticDir, 'pdf', `${id}-speaker-notes.html`))
  }

  progress.current++
  const progressString = `[${progress.current.toString().padStart(progress.padding, '0')}/${progress.total}]`
  context.logger.info(`${progressString} Created PDF for slideset ${id} in ${elapsed(startTime)} ms.`)
}

export async function exportAllAsPNGs(context: BuildContext, staticDir: string): Promise<void> {
  const operationStart = process.hrtime.bigint()

  // Prepare the output directory
  const fullOutput = resolve(rootDir, staticDir, 'png')
  await rm(fullOutput, { recursive: true, force: true })
  await mkdir(fullOutput, { recursive: true })
  context.logger.info(`Exporting PNG files into directory ${fullOutput} ...`)

  // Export all talk
  const talks = filterWhitelistedTalks(context, await getAllTalks())

  const talksArray = [...talks]
  const talksArrayLength = talksArray.length
  const progress = {
    current: 0,
    total: talksArrayLength,
    padding: talksArrayLength.toString().length
  }

  await Promise.all(talksArray.map(t => exportAsPNGs(context, t, context.root, fullOutput, progress)))

  context.logger.info(`Exporting completed in ${elapsed(operationStart)} ms.`)
}

export async function createAllPDFs(context: BuildContext, staticDir: string): Promise<void> {
  const operationStart = process.hrtime.bigint()

  context.logger.info(`Creating PDF files into directory ${staticDir}/pdfs ...`)

  // Prepare the output directory
  await rm(resolve(rootDir, staticDir, 'pdf'), { recursive: true, force: true })
  await mkdir(resolve(rootDir, staticDir, 'pdf'), { recursive: true })

  const talks = filterWhitelistedTalks(context, await getAllTalks())

  const talksArray = [...talks]
  const talksArrayLength = talksArray.length
  const progress = {
    current: 0,
    total: talksArrayLength,
    padding: talksArrayLength.toString().length
  }

  await Promise.all(talksArray.map(t => createPDF(context, t, staticDir, progress)))

  context.logger.info(`Created all PDF files in ${elapsed(operationStart)} ms.`)
}

export async function generateAllSlidesets(context: BuildContext): Promise<Record<string, string>> {
  // For each talk, generate one file per slideset
  const talks = context.extensions.freya.talks as Set<string>
  const total = talks.size
  const totalPadded = total.toString()
  let i = 0
  const padding = totalPadded.length
  const generated: Record<string, string> = {}

  // For each talk
  for (const id of talks) {
    i++
    const startTime = process.hrtime.bigint()
    const talk = await getTalk(id)
    const theme = await getTheme(talk.config.theme)
    const [commonImages, themeImages, talkImages] = await listThemeAndTalkImages(theme.id, talk.id)

    const clientContext = await prepareClientContext(context, theme, talk)
    const layouts: Record<string, string> = {}

    // Render the slides
    for (let i = 0; i < talk.slides.length; i++) {
      const slide = talk.slides[i]

      // Render the slide on the server to add the required classes
      const layoutPath = resolve(
        rootDir,
        'src/themes',
        talk.config.theme,
        'layouts',
        (slide.layout ?? 'default') + '.tsx'
      )

      const { default: layout }: { default: SlideRenderer } = await import(layoutPath)
      layouts[slide.layout ?? 'default'] = layoutPath

      const body =
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
        ) + render(SvgDefinitions({ definitions: clientContext.assets.svgsDefinitions }))

      const html = render(
        page({
          talk,
          theme,
          commonImages,
          themeImages,
          talkImages,
          js: '',
          title: talk.document.title,
          body,
          bodyClassName: undefined,
          messageClassName: undefined
        })
      )

      generated[slideTemporaryFileName(talk, i)] = html
    }

    // Generate speaker notes if appropriate
    if (talk.slides.some(s => (s.notes ?? '').length > 0)) {
      const bodyClassName = cleanCssClasses('freya@root', 'freya@speaker-notes__body')
      const body = speakerNotesBody({ talk })
      const page = speakerNotesPage(context, bodyClassName)

      generated[slideTemporaryNotesName(talk)] = render(page).replace('@BODY@', render(body))
    }

    const progress = `[${i.toString().padStart(padding, '0')}/${totalPadded}]`
    context.logger.info(`${progress} Generated slideset ${id} in ${elapsed(startTime)} ms.`)
  }

  return generated
}

// This is used as dante build in export mode
export async function build(context: BuildContext): Promise<BuildResult> {
  context.logger.info(`Building site (version ${context.version}) ...`)

  // Clean up the directory
  const baseDir = context.root
  await rm(baseDir, { force: true, recursive: true })
  await mkdir(baseDir)
  await mkdir(resolve(baseDir, 'assets/talks'), { recursive: true })
  await mkdir(resolve(baseDir, 'assets/themes'), { recursive: true })

  // Prepare the context
  context.extensions.freya.images = new Set()
  context.extensions.freya.talks = filterWhitelistedTalks(context, await getAllTalks())

  context.logger.info(`Exporting slideset(s): ${Array.from(context.extensions.freya.talks as Set<string>).join(', ')}`)

  let fileOperations: Promise<void>[] = []

  // Generate the slidesets
  const slides = await generateAllSlidesets(context)
  fileOperations = Object.entries(slides).map(([name, content]) => {
    return writeFile(resolve(baseDir, name), content, 'utf-8')
  })

  await Promise.all(fileOperations)
  fileOperations = []
  const themes = new Set()

  // Copy common assets
  const commonAssets = resolve(rootDir, 'src/themes/common/assets')
  fileOperations.push(
    cp(commonAssets, resolve(baseDir, 'assets/themes/common'), {
      recursive: true
    })
  )
  themes.add('common')

  // Copy themes and talks assets
  for (const talk of context.extensions.freya.talks as string[]) {
    const {
      config: { theme }
    } = await getTalk(talk)
    const talkAssets = resolve(rootDir, 'src/talks', talk, 'assets')
    const themeAssets = resolve(rootDir, 'src/themes', theme, 'assets')
    if (existsSync(talkAssets)) {
      fileOperations.push(
        cp(talkAssets, resolve(baseDir, 'assets/talks', talk), {
          recursive: true
        })
      )
    }
    if (!themes.has(theme) && existsSync(themeAssets)) {
      fileOperations.push(
        cp(themeAssets, resolve(baseDir, 'assets/themes', theme), {
          recursive: true
        })
      )
    }
    themes.add(theme)
  }

  await Promise.all(fileOperations)
  fileOperations = []

  // Remove all file and directory starting with a double underscore
  for (const p of await glob(resolve(baseDir, 'assets/**/__*'))) {
    fileOperations.push(rm(p, { recursive: true }))
  }

  await Promise.all(fileOperations)

  return { css, cssVisitor }
}
