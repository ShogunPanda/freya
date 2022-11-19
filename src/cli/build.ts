import globCb from 'glob'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import pino from 'pino'
import { elapsedTime, generateSlidesets } from '../generation/generator.js'
import { getTalk, getTalks, rootDir } from '../generation/loader.js'
import { Context } from '../generation/models.js'

const glob = promisify(globCb)

function generateNetlifyConfiguration(context: Context): string {
  const startTime = process.hrtime.bigint()
  let generated = ''

  for (const talk of context.talks) {
    generated += `[[redirects]]\nfrom = "/${talk}/*"\nto = "/${talk}.html"\nstatus = 200\n\n`
  }

  context.log.info(`Generated TOML file /netlify.toml in ${elapsedTime(startTime)} ms`)

  return generated.trim()
}

export async function build(output: string): Promise<void> {
  const fullOutput = resolve(rootDir, output)

  // Prepare the context
  const logger = pino({ transport: { target: 'pino-pretty' } })
  logger.info(`Building into directory ${output} ...`)

  const context: Context = {
    log: logger,
    talks: await getTalks(),
    slidesets: {}
  }

  // Generate the slidesets
  context.slidesets = await generateSlidesets(context)

  // Prepare output directory
  await rm(fullOutput, { recursive: true, force: true })
  await mkdir(fullOutput, { recursive: true })
  await mkdir(resolve(fullOutput, 'assets/talks'), { recursive: true })
  await mkdir(resolve(fullOutput, 'assets/themes'), { recursive: true })

  // Write slidesets
  for (const [name, file] of Object.entries(context.slidesets)) {
    await writeFile(resolve(fullOutput, `${name}.html`), file, 'utf8')
  }

  // Copy file 404.html and netlify.toml
  await cp(fileURLToPath(new URL('../assets/404.html', import.meta.url)), resolve(fullOutput, '404.html'))
  await writeFile(resolve(fullOutput, 'netlify.toml'), generateNetlifyConfiguration(context), 'utf8')

  // Copy themes and talks assets
  for (const talk of context.talks) {
    await cp(resolve(rootDir, 'src/talks', talk, 'assets'), resolve(fullOutput, 'assets/talks', talk), {
      recursive: true
    })

    const {
      config: { theme }
    } = await getTalk(talk)
    await cp(resolve(rootDir, 'src/themes', theme, 'assets'), resolve(fullOutput, 'assets/themes', theme), {
      recursive: true
    })
  }

  // Remove all file and directory starting with a double underscore
  for (const p of await glob(resolve(fullOutput, 'assets/**/__*'))) {
    await rm(p, { recursive: true })
  }
}
