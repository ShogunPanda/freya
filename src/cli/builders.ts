import { watch } from 'chokidar'
import { glob } from 'glob'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import pino from 'pino'
import Pusher, { Channel, ChannelAuthorizationOptions } from 'pusher-js'
import { elapsedTime, finalizeJs, generateSlidesets } from '../generation/generator.js'
import { getTalk, getTalks, pusherConfig, rootDir, swc } from '../generation/loader.js'
import { Context } from '../generation/models.js'

let whitelistedTalks = workerData?.whitelistedTalks ?? []

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
  let generated = '[build]\npublish = "site"\nedge_functions = "functions"\n\n'

  for (const talk of context.talks) {
    generated += `[[redirects]]\nfrom = "/${talk}/*"\nto = "/${talk}.html"\nstatus = 200\n\n`
  }

  if (pusherConfig) {
    generated += '[[edge_functions]]\npath = "/pusher/auth"\nfunction = "pusher-auth"\n\n'
  }

  context.log.info(`Generated TOML file netlify.toml in ${elapsedTime(startTime)} ms`)

  return generated.trim()
}

async function generateHotReloadPage(): Promise<string> {
  let page = await readFile(fileURLToPath(new URL('../assets/status.html', import.meta.url)), 'utf8')

  if (pusherConfig) {
    const client = await readFile(fileURLToPath(new URL('../assets/hot-reload.js', import.meta.url)), 'utf8')

    let pusher: string = ''
    if (pusherConfig) {
      for (const rootModuleDirectory of ['node_modules', 'node_modules/freya-slides/node_modules']) {
        try {
          pusher = await readFile(resolve(rootDir, rootModuleDirectory, 'pusher-js/dist/web/pusher.js'), 'utf8')
        } catch (error) {
          if (error.code !== 'ENOENT') {
            throw error
          }
        }
      }

      if (!pusher) {
        throw new Error('Cannot find pusher-js module.')
      }

      page = page.replace(
        "console.warn('No pusher available. Hot reload disabled.')",
        await finalizeJs(
          pusher +
            '\n' +
            client.replace(
              'const context = {}',
              `const context = ${JSON.stringify({
                key: pusherConfig.key,
                cluster: pusherConfig.cluster,
                hostname: hostname()
              })}`
            )
        )
      )
    }
  }

  return page
}

async function generatePusherAuthFunction(context: Context): Promise<string> {
  const startTime = process.hrtime.bigint()
  let functionFile = await readFile(new URL('../templates/pusher-auth.js', import.meta.url), 'utf8')
  functionFile = functionFile.replace('@KEY@', pusherConfig!.key).replace('@SECRET@', pusherConfig!.secret)

  context.log.info(`Generated function pusher-auth.js in ${elapsedTime(startTime)} ms`)

  return functionFile
}

function notifyBuildStatus(
  channel: Channel | undefined,
  status: 'pending' | 'success' | 'failed',
  payload?: object
): void {
  if (!channel) {
    return
  }

  channel.trigger('client-update', { status, ...payload })
}

export function filterWhitelistedTalks(talks: Set<string>): Set<string> {
  if (whitelistedTalks.length === 0) {
    return talks
  }
  return new Set([...talks].filter(t => whitelistedTalks.includes(t)))
}

export function setWhitelistedTalks(whitelist: string): void {
  if (!whitelist) {
    return
  }

  whitelistedTalks = whitelist.split(/\s*,\s*/).map(w => w.trim())
}

export async function developmentBuilder(logger: pino.Logger, ip: string, port: number): Promise<void> {
  let compiling = false
  let success: () => void
  let fail: (reason?: Error) => void

  const promise = new Promise<void>((resolve, reject) => {
    success = resolve
    fail = reject
  })

  let timeout: NodeJS.Timeout | null
  let pusherChannel: Channel

  if (pusherConfig) {
    pusherChannel = new Pusher(pusherConfig.key, {
      cluster: pusherConfig.cluster,
      channelAuthorization: {
        endpoint: `http://${ip === '::' ? '127.0.0.1' : ''}:${port}/pusher/auth`
      } as unknown as ChannelAuthorizationOptions
    }).subscribe(`private-talks-${hostname()}-build-status`)

    pusherChannel.bind('pusher:subscription_error', (event: any) => {
      console.error('Subscription failed', event)
    })
    pusherChannel.bind('pusher:error', (event: any) => {
      console.error('Sending build synchronization failed', event)
    })
  }

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
    let failed = false

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
          .trim()

        failed = true
        logger.error('Code compilation failed:\n\n  ' + errorString + '\n')
        notifyBuildStatus(pusherChannel, 'failed', { error: errorString })
        return
      }

      const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { whitelistedTalks } })

      worker.on('message', message => {
        if (message === 'started') {
          notifyBuildStatus(pusherChannel, 'pending')
        }
      })

      worker.on('error', error => {
        compiling = false

        const errorStack = (
          error.stack?.toString().trim().replaceAll(/(^.)/gm, '$1'.padStart(17, ' ')).replaceAll(rootDir, '$ROOT') ?? ''
        ).trim()

        const errorString = error.message + errorStack + '\n\n'

        failed = true
        notifyBuildStatus(pusherChannel, 'failed', { error: errorString })
        logger.error('Code compilation failed:\n\n  ' + errorString + '\n')

        worker.terminate().catch(() => {})
      })

      worker.on('exit', () => {
        if (!failed) {
          notifyBuildStatus(pusherChannel, 'success')
        }

        compiling = false
      })
    })
  }

  const watcher = watch([resolve(rootDir, 'src'), resolve(rootDir, 'config')], {
    persistent: true
  })

  process.on('SIGINT', () => {
    watcher.close().then(success).catch(fail)

    if (pusherChannel) {
      pusherChannel.pusher.disconnect()
    }
  })

  watcher.on('add', scheduleRun).on('change', scheduleRun).on('unlink', scheduleRun).on('error', fail!)
  return promise
}

export async function productionBuilder(output: string = 'dist/html', netlify: boolean = false): Promise<void> {
  if (!existsSync(resolve(rootDir, './tmp')) || isMainThread) {
    await compileSourceCode()
  }

  const fullOutput = resolve(rootDir, output)
  await rm(fullOutput, { force: true, recursive: true })
  await mkdir(fullOutput, { recursive: true })

  const logger = pino({ transport: { target: 'pino-pretty' }, level: process.env.LOG_LEVEL ?? 'info' })
  logger.info(`Building HTML version into directory ${output} ...`)
  const startTime = process.hrtime.bigint()

  // Prepare output directory
  await rm(fullOutput, { recursive: true, force: true })
  await mkdir(fullOutput, { recursive: true })
  await mkdir(resolve(fullOutput, 'assets/talks'), { recursive: true })
  await mkdir(resolve(fullOutput, 'assets/themes'), { recursive: true })

  // Copy file 404.html
  await cp(fileURLToPath(new URL('../assets/404.html', import.meta.url)), resolve(fullOutput, '404.html'))

  // Create wait file
  const statusFilePath = !isMainThread ? resolve(fullOutput, '__status.html') : undefined
  if (statusFilePath) {
    await writeFile(statusFilePath, await generateHotReloadPage(), 'utf8')
    parentPort?.postMessage('started')
  }

  // Prepare the context
  const context: Context = {
    environment: isMainThread ? 'production' : 'development',
    log: logger,
    talks: filterWhitelistedTalks(await getTalks()),
    slidesets: {}
  }

  // Generate the slidesets
  context.slidesets = await generateSlidesets(context)

  // Write slidesets
  for (const [name, file] of Object.entries(context.slidesets)) {
    await writeFile(resolve(fullOutput, `${name}.html`), file, 'utf8')
  }

  // Generate Netlify and Pusher, if needed
  if (netlify) {
    await writeFile(resolve(fullOutput, '../netlify.toml'), generateNetlifyConfiguration(context), 'utf8')
  }

  if (pusherConfig) {
    await mkdir(resolve(fullOutput, '../functions'), { recursive: true })
    await writeFile(
      resolve(fullOutput, '../functions/pusher-auth.js'),
      await generatePusherAuthFunction(context),
      'utf8'
    )
  }

  // Copy themes and talks assets
  let fileOperations: Promise<void>[] = []
  const themes = new Set()
  for (const talk of context.talks) {
    const {
      config: { theme }
    } = await getTalk(talk, context.log)

    const talkAssets = resolve(rootDir, 'src/talks', talk, 'assets')
    const themeAssets = resolve(rootDir, 'src/themes', theme, 'assets')

    if (existsSync(talkAssets)) {
      fileOperations.push(
        cp(talkAssets, resolve(fullOutput, 'assets/talks', talk), {
          recursive: true
        })
      )
    }

    if (!themes.has(theme) && existsSync(themeAssets)) {
      fileOperations.push(
        cp(themeAssets, resolve(fullOutput, 'assets/themes', theme), {
          recursive: true
        })
      )
    }

    themes.add(theme)
  }

  await Promise.all(fileOperations)
  fileOperations = []

  // Remove all file and directory starting with a double underscore
  for (const p of await glob(resolve(fullOutput, 'assets/**/__*'))) {
    fileOperations.push(rm(p, { recursive: true }))
  }

  // Remove waiting file
  if (statusFilePath) {
    fileOperations.push(rm(statusFilePath))
  }

  await Promise.all(fileOperations)

  logger.info(`Build completed in ${elapsedTime(startTime)} ms.`)
}

if (!isMainThread) {
  await productionBuilder()
}
