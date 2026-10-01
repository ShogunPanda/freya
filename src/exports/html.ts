import type { BuildContext } from '@perseveranza-pets/dante'
import type { Command } from 'commander'
import type pino from 'pino'
import type { SlideRenderer } from '../slidesets/models.ts'
import { mkdir, mkdtemp, readdir, rename, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { builder, cleanCssClasses, createBuildContext, rootDir } from '@perseveranza-pets/dante'
import { render } from 'preact-render-to-string'
import { SvgDefinitions } from '../client.ts'
import { setWhitelistedTalks } from '../configuration.ts'
import { resolveSVG } from '../rendering/svg.tsx'
import { parseContent, prepareClientContext } from '../slidesets/generators.tsx'
import { collectTalkImages, getTalk, getTheme } from '../slidesets/loaders.ts'
import { page } from '../templates/page.tsx'
import { SlideComponent } from '../templates/slide.tsx'
import { body as speakerNotesBody, page as speakerNotesPage } from '../templates/speaker-notes.tsx'

export async function performBuild(command: Command, logger: pino.Logger): Promise<void> {
  let staging: string | undefined
  try {
    const { directory: staticDir, only } = command.optsWithGlobals()
    setWhitelistedTalks(only)
    const output = resolve(rootDir, staticDir)
    await mkdir(output, { recursive: true })
    // Dante clears its output root; isolate HTML generation from cached exports.
    staging = await mkdtemp(resolve(output, '.freya-build-'))
    const context = createBuildContext(logger, true, staging)
    context.extensions.freya = { netlify: true }
    await builder(context)
    for (const name of await readdir(staging)) {
      const destination = resolve(output, name)
      await rm(destination, { recursive: true, force: true })
      await rename(resolve(staging, name), destination)
    }
  } catch (error) {
    throw new Error('Preparing the HTML deployment failed.', { cause: error })
  } finally {
    if (staging) {
      await rm(staging, { recursive: true, force: true })
    }
  }
}

export async function generateAllSlidesets(
  context: BuildContext,
  prepare?: (slides: Record<string, string>) => Promise<void>
): Promise<Record<string, string>> {
  const talks = context.extensions.freya.talks as Set<string>
  const total = talks.size
  const padding = total.toString().length
  const generated: Record<string, string> = {}
  let current = 0
  for (const id of talks) {
    const start = performance.now()
    const slides: Record<string, string> = {}
    const talk = await getTalk(id)
    const theme = await getTheme(talk.config.theme)
    const clientContext = await prepareClientContext(context, theme, talk)
    const { commonImages, themeImages, talkImages, resolveImage } = collectTalkImages(clientContext)
    for (const [index, slide] of talk.slides.entries()) {
      const layoutPath = resolve(rootDir, 'src/themes', theme.id, 'layouts', (slide.layout ?? 'default') + '.tsx')
      const { default: layout }: { default: SlideRenderer } = await import(layoutPath)
      const body =
        render(
          SlideComponent({
            context: clientContext,
            layout,
            slide,
            index: index + 1,
            resolveImage,
            resolveSVG: resolveSVG.bind(null, clientContext.assets.svgsDefinitions, clientContext.assets.svgs),
            parseContent: parseContent.bind(null, clientContext.assets.content)
          })
        ) + render(SvgDefinitions({ definitions: clientContext.assets.svgsDefinitions }))
      const name = `${id}/${(index + 1).toString().padStart(talk.slidesPadding, '0')}.html`
      slides[name] = render(
        page({
          talk,
          theme,
          commonImages,
          themeImages,
          talkImages,
          exporting: true,
          fontUrls: context.extensions.freya.fonts.urls,
          js: '',
          title: talk.document.title,
          body
        })
      )
    }
    if (talk.slides.some(slide => (slide.notes ?? '').length > 0)) {
      const bodyClassName = cleanCssClasses('freya@root', 'freya@speaker-notes__body')
      slides[`${id}/speaker-notes.html`] = render(speakerNotesPage(context, bodyClassName)).replace(
        '@BODY@',
        render(speakerNotesBody({ talk }))
      )
    }
    if (prepare) {
      await prepare(slides)
    }
    Object.assign(generated, slides)
    const progress = `[${String(++current).padStart(padding, '0')}/${total}]`
    context.logger.info(
      `${progress} Prepared ${talk.slidesCount} slides for slideset ${id} in ${(performance.now() - start).toFixed(2)}ms.`
    )
  }
  return generated
}
