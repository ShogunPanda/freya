import { elapsed, loadFontsFile, rootDir, type BuildContext, type BuildResult } from '@perseveranza-pets/dante'
import { glob } from 'glob'
import { existsSync } from 'node:fs'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { filterWhitelistedTalks, isServiceWorkerEnabled, pusherConfig } from './configuration.ts'
import { css, cssVisitor } from './css.ts'
import { readFile } from './fs.ts'
import {
  generateAllSlidesets,
  generateAssetsListing,
  generatePage404,
  listThemeAndTalkImages
} from './slidesets/generators.tsx'
import { getAllTalks, getTalk, resolveImageUrl } from './slidesets/loaders.ts'
import { indexServiceWorkerDeclaration, talkServiceWorkerDeclaration } from './templates/service-workers.ts'

declare module 'fastify' {
  interface FastifyReply {
    sendFile: (filename: string, dirname?: string) => FastifyReply
  }
}

async function generateNetlifyConfiguration(context: BuildContext): Promise<string> {
  const startTime = process.hrtime.bigint()
  let generated = '[build]\npublish = "site"\n\n'

  for (const talk of context.extensions.freya.talks as Set<string>) {
    const {
      config: { theme }
    } = await getTalk(talk)

    generated += `[[redirects]]\nfrom = "/${talk}/assets/common/*"\nto = "/assets/themes/common/:splat"\nstatus = 200\n\n`
    generated += `[[redirects]]\nfrom = "/${talk}/assets/theme/*"\nto = "/assets/themes/${theme}/:splat"\nstatus = 200\n\n`
    generated += `[[redirects]]\nfrom = "/${talk}/assets/talk/*"\nto = "/assets/talks/${talk}/:splat"\nstatus = 200\n\n`
    generated += `[[redirects]]\nfrom = "/${talk}/sw.js"\nto = "/assets/talks/${talk}/sw.js"\nstatus = 200\n\n`
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
  context.extensions.freya.images = new Set()
  context.extensions.freya.talks = filterWhitelistedTalks(context, await getAllTalks())

  context.logger.info(`Building slideset(s): ${Array.from(context.extensions.freya.talks as Set<string>).join(', ')}`)

  // Generate the slidesets
  context.extensions.freya.slidesets = await generateAllSlidesets(context)
  context.extensions.freya.slidesets['404'] = generatePage404(context)

  // Write slidesets and track preCache information
  const toPrecache = new Set<string>(context.extensions.freya.images as Set<string>)

  for (const [name, file] of Object.entries(context.extensions.freya.slidesets as Record<string, string>)) {
    toPrecache.add(name === 'index' ? '/' : `/${name}`)

    await writeFile(resolve(baseDir, `${name}.html`), file, 'utf8')
  }

  // Generate Netlify and Pusher, if needed
  if (context.extensions.freya.netlify) {
    await writeFile(resolve(baseDir, '../netlify.toml'), await generateNetlifyConfiguration(context), 'utf8')
  }

  if (pusherConfig) {
    await mkdir(resolve(baseDir, '../functions'), { recursive: true })
    await writeFile(resolve(baseDir, '../functions/pusher-auth.js'), await generatePusherAuthFunction(context), 'utf8')
  }

  let fileOperations: Promise<void>[] = []
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

  if (isServiceWorkerEnabled(context)) {
    await writeFile(resolve(baseDir, 'sw.js'), indexServiceWorkerDeclaration(context), 'utf8')

    for (const talk of context.extensions.freya.talks as string[]) {
      const {
        config: { theme }
      } = await getTalk(talk)

      const [commonImages, themeImages, talkImages] = await listThemeAndTalkImages(theme, talk)

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
            [...commonImages, ...themeImages, ...talkImages].map(i => resolveImageUrl({}, theme, talk, i))
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

  return { css, cssVisitor }
}
