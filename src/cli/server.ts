import fastifyFormBody from '@fastify/formbody'
import fastifyStatic from '@fastify/static'
import fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import fastifyHttpErrorsEnhanced from 'fastify-http-errors-enhanced'
import { BAD_REQUEST, NO_CONTENT, badRequestSchema } from 'http-errors-enhanced'
import { createHmac } from 'node:crypto'
import EventEmitter from 'node:events'
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import type pino from 'pino'
import { pusherConfig, rootDir } from '../generation/loader.js'

interface BuildStatus {
  status: 'pending' | 'success' | 'failed'
  payload?: object
}

interface ServerOptions {
  ip: string
  port: number
  logger: pino.Logger | false
  staticDir: string
  development: boolean
  ssl?: boolean
}

interface TalkHandlerParams {
  talk: string
  slide: string
}

class SynchronizationEventEmitter extends EventEmitter {
  public closed: boolean

  constructor(options?: { captureRejections?: boolean }) {
    super(options)

    this.closed = false
    this.once('close', () => {
      this.closed = true
    })
  }

  close(): void {
    this.emit('close')
  }

  get isClosed(): boolean {
    return this.closed
  }
}

class SynchronizationStream extends Readable {
  private readonly emitter: SynchronizationEventEmitter

  constructor(emitter: SynchronizationEventEmitter) {
    super()

    emitter.on('update', () => {
      this.push(`event: sync\ndata: ${JSON.stringify(buildStatus)}\n\n`)
    })

    emitter.on('close', () => {
      this.push('event: close\ndata:\n\n')
    })

    this.emitter = emitter
    this.push('retry: 10000\n\n')
  }

  _read(): void {
    if (this.emitter.isClosed) {
      this.push(null)
    }
  }
}

const defaultServerOptions: ServerOptions = {
  ip: '::',
  port: 0,
  logger: false,
  staticDir: 'dist/html',
  development: false
}

const buildStatus: BuildStatus = { status: 'pending' }
const buildEmitter = new SynchronizationEventEmitter()

export function notifyBuildStatus(status: 'pending' | 'success' | 'failed', payload?: object): void {
  buildStatus.status = status
  buildStatus.payload = payload
  buildEmitter.emit('update')
}

function pageExists(server: FastifyInstance, page: string): boolean {
  return existsSync(resolve(server.rootDir, `${page}.html`))
}

function talkHandler(
  this: FastifyInstance,
  request: FastifyRequest<{ Params: TalkHandlerParams }>,
  reply: FastifyReply
): void {
  const talk = request.params.talk

  if (talk === '404.html' || talk === '__status.html' || !pageExists(this, talk)) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    reply.code(404).sendFile('404.html')
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  reply.sendFile(`${talk}.html`)
}

function assetsHandler(
  this: FastifyInstance,
  request: FastifyRequest<{ Params: TalkHandlerParams }>,
  reply: FastifyReply
): void {
  const talk = request.params.talk

  if (talk === '404.html' || talk === '__status.html' || !pageExists(this, talk)) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    reply.code(404).sendFile('404.html')
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  reply.sendFile(`${talk}_assets.html`)
}

function syncHandler(this: FastifyInstance, _: FastifyRequest, reply: FastifyReply): void {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  reply
    .header('content-type', 'text/event-stream')
    .header('cache-control', 'no-cache')
    .send(new SynchronizationStream(buildEmitter))

  setTimeout(() => buildEmitter.emit('update'), 100)
}

export async function localServer(options?: Partial<ServerOptions>): Promise<FastifyInstance> {
  const { ip, port, logger, staticDir, development, ssl } = { ...defaultServerOptions, ...options }

  const fullOutput = resolve(rootDir, staticDir)
  await mkdir(fullOutput, { recursive: true })

  const https =
    ssl !== false && existsSync(resolve(rootDir, 'ssl'))
      ? {
          key: await readFile(resolve(rootDir, 'ssl/privkey.pem')),
          cert: await readFile(resolve(rootDir, 'ssl/cert.pem')),
          ca: await readFile(resolve(rootDir, 'ssl/chain.pem'))
        }
      : null

  const server = fastify({
    https,
    logger: logger ?? { transport: { target: 'pino-pretty' } },
    forceCloseConnections: true
  })

  await server.register(fastifyHttpErrorsEnhanced, { handle404Errors: false })
  await server.register(fastifyFormBody)

  if (development) {
    server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (buildStatus.status !== 'success' && request.url !== '/__status') {
        return reply.sendFile('__status.html', resolve(staticDir))
      }
    })

    server.route({
      method: 'GET',
      url: '/__status',
      handler: syncHandler,
      schema: {
        response: {
          [NO_CONTENT]: {},
          [BAD_REQUEST]: badRequestSchema
        }
      }
    })
  }

  if (pusherConfig) {
    const { key, secret } = pusherConfig

    server.route({
      method: 'POST',
      url: '/pusher/auth',
      handler(request: FastifyRequest, reply: FastifyReply) {
        const { socket_id: socket, channel_name: channel } = request.body as Record<string, string>

        const user = JSON.stringify({ id: 'freya-slides-sync-guest' })
        const stringToSign = `${socket}:${channel}`
        const signature = createHmac('sha256', secret).update(stringToSign).digest().toString('hex')

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        reply.send({
          auth: `${key}:${signature}`,
          user_data: user
        })
      }
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

  if (development) {
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

  await server.register(fastifyStatic, {
    root: fullOutput
  })

  server.decorate('rootDir', fullOutput)

  server.setNotFoundHandler(function (_: FastifyRequest, reply: FastifyReply) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    reply.type('text/html').sendFile('404.html')
  })

  process.on('SIGINT', () => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    server.close()
  })

  return new Promise<FastifyInstance>((resolve, reject) => {
    server.listen({ host: ip, port }, (err: Error | null) => {
      if (err) {
        reject(err)
        return
      }

      resolve(server as unknown as FastifyInstance)
    })
  })
}
