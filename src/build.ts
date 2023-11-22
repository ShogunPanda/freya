import { type UserConfig } from '@unocss/core'
import {
  baseTemporaryDirectory,
  createStylesheet as createCSS,
  elapsed,
  rootDir,
  transformCSS,
  type BuildContext,
  type CSSClassGeneratorContext,
  type ValueOrCallback
} from 'dante'
import { extractImages } from 'dante/html-utils'
import { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { glob } from 'glob'
import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { filterWhitelistedTalks, pusherConfig } from './configuration.js'
import { assetsHandler, pusherAuthHandler, talkHandler } from './server.js'
import { generateAllSlidesets, generateAssetsListing } from './slidesets/generators.js'
import { getAllTalks, getTalk, getTheme } from './slidesets/loaders.js'
import { serviceWorker } from './templates/service-worker.js'

declare module 'fastify' {
  interface FastifyReply {
    sendFile: (filename: string) => FastifyReply
  }
}

async function resolveCSS(id: string, config: UserConfig, fonts: string): Promise<string> {
  id = id.replace(/^\/handled\//, '')

  if (id === 'virtual:theme-fonts') {
    return fonts
  } else if (id.startsWith('@freya')) {
    const url = new URL(`./assets/styles/${id.replace('@freya/', '')}`, import.meta.url)

    return transformCSS(config, await readFile(fileURLToPath(url), 'utf8'))
  }

  return `/*!!! not-found: ${id} */`
}

function generateNetlifyConfiguration(context: BuildContext): string {
  const startTime = process.hrtime.bigint()
  let generated = '[build]\npublish = "site"\nedge_functions = "functions"\n\n'

  for (const talk of context.extensions.talks) {
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
  let functionFile = await readFile(new URL('./templates/pusher-auth.js', import.meta.url), 'utf8')
  functionFile = functionFile.replace('@KEY@', pusherConfig!.key).replace('@SECRET@', pusherConfig!.secret)

  context.logger.info(`Generated function pusher-auth.js in ${elapsed(startTime)} ms`)

  return functionFile
}

function getPageCssAttribute<T>(existing: Record<string, T>, createFactory: () => T, context: BuildContext): T {
  const id = basename(context.currentPage ?? '', '.html')

  if (!existing[id]) {
    existing[id] = createFactory()
  }

  return existing[id]
}

export async function createStylesheet(context: BuildContext, page: string, minify: boolean): Promise<string> {
  const id = basename(page, '.html')
  if (id === '404' || id === 'index' || id.endsWith('_assets')) {
    return ''
  }

  const talk = await getTalk(id)

  // Load the theme file and config
  const theme = await getTheme(talk.config.theme)
  const themeFile = await readFile(resolve(rootDir, 'src/themes', theme.id, 'style.css'), 'utf-8')
  const { default: unoConfig } = await import(
    resolve(rootDir, baseTemporaryDirectory, 'themes', theme.id, 'unocss.config.js')
  )

  const cssClasses =
    typeof context.css.classes === 'function' ? await context.css.classes(context) : context.css.classes

  return createCSS(
    unoConfig,
    cssClasses,
    minify,
    async (id: string) => {
      return resolveCSS(id, unoConfig, theme.fontsStyles)
    },
    themeFile
  )
}

export async function build(context: BuildContext): Promise<void> {
  context.logger.info(`Building site (version ${context.version}) ...`)

  // Clean up the directory
  const baseDir = resolve(rootDir, 'dist/html')
  await rm(baseDir, { force: true, recursive: true })
  await mkdir(baseDir)
  await mkdir(resolve(baseDir, 'assets/talks'), { recursive: true })
  await mkdir(resolve(baseDir, 'assets/themes'), { recursive: true })

  // Copy file 404.html
  await cp(fileURLToPath(new URL('assets/404.html', import.meta.url)), resolve(baseDir, '404.html'))

  // Prepare the context
  context.extensions.talks = filterWhitelistedTalks(await getAllTalks())

  context.extensions.css = {
    classes: Object.fromEntries([...context.extensions.talks].map(t => [t, new Set()])),
    classesExpansions: Object.fromEntries([...context.extensions.talks].map(t => [t, []])),
    generator: Object.fromEntries([...context.extensions.talks].map(t => [t, { name: '', counter: 0 }])),
    compressedClasses: Object.fromEntries([...context.extensions.talks].map(t => [t, new Map()]))
  }

  context.css.classes = getPageCssAttribute.bind(
    null,
    context.extensions.css.classes,
    () => new Set()
  ) as ValueOrCallback<Set<string>>
  context.css.compressedClasses = getPageCssAttribute.bind(
    null,
    context.extensions.css.compressedClasses,
    () => new Map()
  ) as ValueOrCallback<Map<string, string>>
  context.css.generator = getPageCssAttribute.bind(null, context.extensions.css.generator, () => {
    return { name: '', counter: 0 }
  }) as ValueOrCallback<CSSClassGeneratorContext>

  // Generate the slidesets
  context.extensions.slidesets = await generateAllSlidesets(context)

  // Write slidesets and track preCache information
  const toPrecache = new Set<string>()

  for (const [name, file] of Object.entries<string>(context.extensions.slidesets)) {
    toPrecache.add(name === 'index' ? '/' : `/${name}`)

    for (const image of extractImages(file)) {
      toPrecache.add(image)
    }

    await writeFile(resolve(baseDir, `${name}.html`), file, 'utf8')
  }

  // Generate Netlify and Pusher, if needed
  if (context.extensions.netlify) {
    await writeFile(resolve(baseDir, '../netlify.toml'), generateNetlifyConfiguration(context), 'utf8')
  }

  if (pusherConfig) {
    await mkdir(resolve(baseDir, '../functions'), { recursive: true })
    await writeFile(resolve(baseDir, '../functions/pusher-auth.js'), await generatePusherAuthFunction(context), 'utf8')
  }

  // Copy themes and talks assets
  let fileOperations: Promise<void>[] = []
  const themes = new Set()

  for (const talk of context.extensions.talks) {
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

  if (context.isProduction) {
    await writeFile(resolve(baseDir, 'sw.js'), serviceWorker(context, Array.from(toPrecache)), 'utf8')
  }

  await Promise.all(fileOperations)
  fileOperations = []

  // Remove all file and directory starting with a double underscore
  for (const p of await glob(resolve(baseDir, 'assets/**/__*'))) {
    fileOperations.push(rm(p, { recursive: true }))
  }

  if (!context.isProduction) {
    const lists = await generateAssetsListing(context)
    for (const [name, file] of Object.entries(lists)) {
      await writeFile(resolve(baseDir, `${name}_assets.html`), file, 'utf8')
    }
  }

  await Promise.all(fileOperations)
}

export function setupServer(server: FastifyInstance, isProduction: boolean): void {
  if (pusherConfig) {
    server.route({
      method: 'POST',
      url: '/pusher/auth',
      handler: pusherAuthHandler
    })
  }

  server.route({
    method: 'GET',
    url: '/',
    handler(this: FastifyInstance, _: FastifyRequest, reply: FastifyReply): void {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      reply.sendFile('index.html')
    }
  })

  server.route({
    method: 'GET',
    url: '/sw.js',
    handler(this: FastifyInstance, _: FastifyRequest, reply: FastifyReply): void {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      reply.sendFile('sw.js')
    }
  })

  server.route({
    method: 'GET',
    url: '/:talk',
    handler: talkHandler
  })

  if (!isProduction) {
    server.route({
      method: 'GET',
      url: '/:talk/assets',
      handler: assetsHandler
    })
  }

  server.route({
    method: 'GET',
    url: '/:talk/:slide(^\\d+)',
    handler: talkHandler
  })
}

export async function safelist(context: BuildContext): Promise<string[]> {
  const id = basename(context.currentPage ?? '', '.html')
  if (!id || id === '404' || id === 'index' || id.endsWith('_assets')) {
    return []
  }

  const talk = await getTalk(id)
  const theme = await getTheme(talk.config.theme)

  const { default: unoConfig } = await import(
    resolve(rootDir, baseTemporaryDirectory, 'themes', theme.id, 'unocss.config.js')
  )

  return unoConfig.safelist
}

export const serverDir = 'html'
