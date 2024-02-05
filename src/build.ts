import {
  baseTemporaryDirectory,
  elapsed,
  fontsToCss,
  loadFontsFile,
  rootDir,
  type BuildContext,
  type BuildResult,
  type Fonts
} from '@perseveranza-pets/dante'
import { type UserConfig } from '@unocss/core'
import { glob } from 'glob'
import { existsSync } from 'node:fs'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { filterWhitelistedTalks, isServiceWorkerEnabled, pusherConfig } from './configuration.js'
import { readFile } from './fs.js'
import { unocssConfig } from './rendering/unocss.config.js'
import {
  generateAllSlidesets,
  generateAssetsListing,
  generatePage404,
  listThemeAndTalkImages
} from './slidesets/generators.js'
import { getAllTalks, getTalk, getTheme, resolveImageUrl } from './slidesets/loaders.js'
import { type Theme } from './slidesets/models.js'
import { indexServiceWorkerDeclaration, talkServiceWorkerDeclaration } from './templates/service-workers.js'

declare module 'fastify' {
  interface FastifyReply {
    sendFile: (filename: string, dirname?: string) => FastifyReply
  }
}

function generateNetlifyConfiguration(context: BuildContext): string {
  const startTime = process.hrtime.bigint()
  let generated = '[build]\npublish = "site"\nedge_functions = "functions"\n\n'

  for (const talk of context.extensions.freya.talks) {
    generated += `[[redirects]]\nfrom = "/${talk}/*"\nto = "/${talk}.html"\nstatus = 200\n\n`
  }

  if (pusherConfig) {
    generated += '[[edge_functions]]\npath = "/pusher/auth"\nfunction = "pusher-auth"\n\n'
  }

  context.logger.info(`Generated TOML file netlify.toml in ${elapsed(startTime)} ms`)

  return generated.trim()
}

async function generatePusherAuthFunction(context: BuildContext): Promise<string> {
  const startTime = process.hrtime.bigint()
  let functionFile = await readFile(new URL('./templates/pusher-auth.js', import.meta.url))
  functionFile = functionFile.replace('@KEY@', pusherConfig!.key).replace('@SECRET@', pusherConfig!.secret)

  context.logger.info(`Generated function pusher-auth.js in ${elapsed(startTime)} ms`)

  return functionFile
}

export async function cssConfig(context: BuildContext): Promise<UserConfig<object>> {
  let id = basename(context.currentPage ?? '', '.html')

  if (id && context.extensions.freya.export) {
    id = id.endsWith('--notes') ? 'speaker-notes' : id.split('--').shift()!
  }

  if (!id || id === '404' || id === 'index' || id.endsWith('_assets') || id === 'speaker-notes') {
    return unocssConfig
  }

  const talk = await getTalk(id)
  const theme = await getTheme(talk.config.theme)

  const { default: unoConfig } = await import(
    resolve(rootDir, baseTemporaryDirectory, 'themes', theme.id, 'unocss.config.js')
  )

  return unoConfig
}

export async function css(context: BuildContext): Promise<string> {
  let id = basename(context.currentPage ?? '', '.html')

  if (id && context.extensions.freya.export) {
    id = id.endsWith('--notes') ? 'speaker-notes' : id.split('--').shift()!
  }

  let themeFile: string
  let theme: Theme | undefined

  if (!id || id === '404' || id === 'index' || id.endsWith('_assets') || id === 'speaker-notes') {
    themeFile = await readFile(new URL('./assets/styles/freya.css', import.meta.url))
  } else {
    const talk = await getTalk(id)
    theme = await getTheme(talk.config.theme)

    themeFile = await readFile(resolve(rootDir, 'src/themes', theme.id, 'style.css'))
  }

  const matcher = /^@import (['"])(.+)(\1);$/m
  let mo: RegExpMatchArray | null = ['']
  while (mo) {
    mo = themeFile.match(matcher)

    if (!mo) {
      break
    }

    const id = mo[2]
    let replacement: string = ''

    if (id === '@theme/fonts') {
      if (theme) {
        replacement = fontsToCss(theme.fonts)
      } else {
        replacement = fontsToCss(context.extensions.freya.fonts as Fonts)
      }
    } else if (id.startsWith('@freya')) {
      const url = new URL(`./assets/styles/${id.replace('@freya/', '')}`, import.meta.url)

      replacement = await readFile(url)
    }

    themeFile = themeFile.replaceAll(mo[0], replacement)
  }

  // Before returning, also swap the context CSS with the subcontext CSS
  if (!id || id === 'index') {
    context.css = context.extensions.freya.css.__index
  } else if (id.endsWith('_assets')) {
    context.css = context.extensions.freya.css.__assets
  } else if (id === '404') {
    context.css = context.extensions.freya.css.__404
  } else if (id === 'speaker-notes') {
    context.css = context.extensions.freya.css['__speaker-notes']
  } else {
    context.css = context.extensions.freya.css[id]
  }

  return themeFile
}

export async function build(context: BuildContext): Promise<BuildResult> {
  context.logger.info(`Building site (version ${context.version}) ...`)

  // Clean up the directory
  const baseDir = resolve(rootDir, 'dist/html')
  await rm(baseDir, { force: true, recursive: true })
  await mkdir(baseDir)
  await mkdir(resolve(baseDir, 'assets/talks'), { recursive: true })
  await mkdir(resolve(baseDir, 'assets/themes'), { recursive: true })

  // Prepare the context
  if (typeof context.extensions.freya === 'undefined') {
    context.extensions.freya = {}
  }

  context.extensions.freya.fonts = await loadFontsFile(
    fileURLToPath(new URL('./assets/styles/fonts.yml', import.meta.url))
  )
  context.extensions.freya.css = {}
  context.extensions.freya.images = new Set()
  context.extensions.freya.talks = filterWhitelistedTalks(context, await getAllTalks())

  context.logger.info(`Building slideset(s): ${Array.from(context.extensions.freya.talks as Set<string>).join(', ')}`)

  // Generate the slidesets
  context.extensions.freya.slidesets = await generateAllSlidesets(context)
  context.extensions.freya.slidesets['404'] = await generatePage404(context)

  // Write slidesets and track preCache information
  const toPrecache = new Set<string>(context.extensions.freya.images as Set<string>)

  for (const [name, file] of Object.entries(context.extensions.freya.slidesets as Record<string, string>)) {
    toPrecache.add(name === 'index' ? '/' : `/${name}`)

    await writeFile(resolve(baseDir, `${name}.html`), file, 'utf8')
  }

  // Generate Netlify and Pusher, if needed
  if (context.extensions.freya.netlify) {
    await writeFile(resolve(baseDir, '../netlify.toml'), generateNetlifyConfiguration(context), 'utf8')
  }

  if (pusherConfig) {
    await mkdir(resolve(baseDir, '../functions'), { recursive: true })
    await writeFile(resolve(baseDir, '../functions/pusher-auth.js'), await generatePusherAuthFunction(context), 'utf8')
  }

  // Copy themes and talks assets
  let fileOperations: Promise<void>[] = []
  const themes = new Set()

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

  if (isServiceWorkerEnabled(context)) {
    await writeFile(resolve(baseDir, 'sw.js'), indexServiceWorkerDeclaration(context), 'utf8')

    for (const talk of context.extensions.freya.talks as string[]) {
      const {
        config: { theme }
      } = await getTalk(talk)

      const [themeImages, talkImages] = await listThemeAndTalkImages(theme, talk)

      const swDir = resolve(baseDir, 'assets/talks', talk)

      if (!existsSync(swDir)) {
        await mkdir(swDir)
      }

      fileOperations.push(
        writeFile(
          resolve(baseDir, 'assets/talks', talk, 'sw.js'),
          talkServiceWorkerDeclaration(
            context,
            talk,
            [...themeImages, ...talkImages].map(i => resolveImageUrl({}, theme, talk, i))
          ),
          'utf8'
        )
      )
      themes.add(theme)
    }
  }

  await Promise.all(fileOperations)
  fileOperations = []

  // Remove all file and directory starting with a double underscore
  for (const p of await glob(resolve(baseDir, 'assets/*/*/**/__*'))) {
    fileOperations.push(rm(p, { recursive: true }))
  }

  if (!context.isProduction) {
    const lists = await generateAssetsListing(context)
    for (const [name, file] of Object.entries(lists)) {
      await writeFile(resolve(baseDir, `${name}_assets.html`), file, 'utf8')
    }
  }

  await Promise.all(fileOperations)

  return { cssConfig, css }
}
