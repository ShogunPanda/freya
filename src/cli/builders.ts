import { watch } from 'chokidar'
import globCb from 'glob'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { isMainThread, Worker } from 'node:worker_threads'
import pino from 'pino'
import { elapsedTime, generateSlidesets } from '../generation/generator.js'
import { getTalk, getTalks, rootDir, swc } from '../generation/loader.js'
import { Context } from '../generation/models.js'

const glob = promisify(globCb)

function compileSourceCode(): Promise<void> {
  let success: () => void
  let fail: (reason?: Error) => void

  const promise = new Promise<void>((resolve, reject) => {
    success = resolve
    fail = reject
  })

  const compilation = spawn(swc, ['-d', 'tmp', 'src'])
  let error = Buffer.alloc(0)

  compilation.stderr.on('data', chunk => {
    error = Buffer.concat([error, chunk])
  })

  compilation.on('close', code => {
    if (code !== 0) {
      const errorString = error
        .toString()
        .trim()
        .replaceAll(/(^.)/gm, '$1'.padStart(17, ' '))
        .replaceAll(rootDir, '$ROOT')

      fail(new Error('Code compilation failed:\n\n  ' + errorString + '\n'))
    }

    success()
  })

  return promise
}

function generateNetlifyConfiguration(context: Context): string {
  const startTime = process.hrtime.bigint()
  let generated = ''

  for (const talk of context.talks) {
    generated += `[[redirects]]\nfrom = "/${talk}/*"\nto = "/${talk}.html"\nstatus = 200\n\n`
  }

  context.log.info(`Generated TOML file /netlify.toml in ${elapsedTime(startTime)} ms`)

  return generated.trim()
}

export function developmentBuilder(logger: pino.Logger): Promise<void> {
  let compiling = false
  let success: () => void
  let fail: (reason?: Error) => void

  const promise = new Promise<void>((resolve, reject) => {
    success = resolve
    fail = reject
  })

  let timeout: NodeJS.Timeout | null

  function scheduleRun(): void {
    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(run, 10)
  }

  function run(): void {
    timeout = null

    if (compiling) {
      return
    }

    compiling = true

    const compilation = spawn(swc, ['-d', 'tmp', 'src'])
    let error = Buffer.alloc(0)

    compilation.stderr.on('data', chunk => {
      error = Buffer.concat([error, chunk])
    })

    compilation.on('close', code => {
      if (code !== 0) {
        compiling = false
        const errorString = error
          .toString()
          .trim()
          .replaceAll(/(^.)/gm, '$1'.padStart(17, ' '))
          .replaceAll(rootDir, '$ROOT')

        logger.error('Code compilation failed:\n\n  ' + errorString + '\n')
        return
      }

      const worker = new Worker(fileURLToPath(import.meta.url))
      worker.on('error', error => {
        compiling = false
        fail(error)
      })

      worker.on('exit', () => {
        compiling = false
      })
    })
  }

  const watcher = watch([resolve(rootDir, 'src'), resolve(rootDir, 'config')], {
    persistent: true
  })

  process.on('SIGINT', () => {
    watcher.close().then(success).catch(fail)
  })

  watcher.on('add', scheduleRun).on('change', scheduleRun).on('unlink', scheduleRun).on('error', fail!)
  return promise
}

export async function productionBuilder(): Promise<void> {
  if (!existsSync(resolve(rootDir, './tmp')) || isMainThread) {
    await compileSourceCode()
  }

  const output = 'dist/html'
  const fullOutput = resolve(rootDir, output)

  // Prepare the context
  const logger = pino({ transport: { target: 'pino-pretty' } })
  logger.info(`Building into directory ${output} ...`)

  const context: Context = {
    environment: isMainThread ? 'production' : 'development',
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

if (!isMainThread) {
  await productionBuilder()
}
