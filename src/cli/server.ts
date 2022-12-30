import fastifyStatic from '@fastify/static'
import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fastifyHttpErrorsEnhanced from 'fastify-http-errors-enhanced'
import { BadRequestError, badRequestSchema, BAD_REQUEST, NO_CONTENT } from 'http-errors-enhanced'
import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import pino from 'pino'
import { getTalk, getTalks, rootDir } from '../generation/loader.js'

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

    emitter.on('sync', current => {
      this.push(`event: sync\ndata: ${JSON.stringify({ current })}\n\n`)
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

function talkHandler(
  this: FastifyInstance,
  request: FastifyRequest<{ Params: TalkHandlerParams }>,
  reply: FastifyReply
): void {
  const talk = request.params.talk

  if (!this.talks.has(talk)) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    reply.code(404).sendFile('404.html')
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  reply.sendFile(`${talk}.html`)
}

function syncHandler(
  this: FastifyInstance,
  request: FastifyRequest<{ Params: TalkHandlerParams }>,
  reply: FastifyReply
): void {
  const talk = request.params.talk

  if (!this.talks.has(talk)) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    reply.code(404).sendFile('404.html')
    return
  }

  // Create the event emitter which will be associated with this socket
  if (!this.syncEmitters[talk]) {
    this.syncEmitters[talk] = new Set()
  }

  const emitter = new SynchronizationEventEmitter()
  this.syncEmitters[talk].add(emitter)

  // Remove the emitter when the socket is closed
  request.socket.on('close', () => {
    emitter.close()
    this.syncEmitters[talk].delete(emitter)
  })

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  reply
    .header('content-type', 'text/event-stream')
    .header('cache-control', 'no-cache')
    .send(new SynchronizationStream(emitter))
}

async function updateSyncHandler(
  this: FastifyInstance,
  request: FastifyRequest<{ Params: TalkHandlerParams }>,
  reply: FastifyReply
): Promise<string | undefined> {
  const talk = request.params.talk
  const rawSlide = request.params.slide

  if (!this.talks.has(talk)) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    reply.code(404).sendFile('404.html')
    return
  }

  const slide = Number.parseInt(rawSlide, 10)

  const talkInfo = await getTalk(talk)
  if (typeof slide !== 'number' || Number.isNaN(slide) || slide < 1 || slide > talkInfo.slidesCount) {
    throw new BadRequestError('Invalid slide.')
  }

  for (const emitter of this.syncEmitters[talk]) {
    emitter.emit('sync', slide)
  }

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  reply.code(204)
  return ''
}

export async function localServer(ip: string, port: number, logger?: pino.Logger | false): Promise<FastifyInstance> {
  const https = existsSync(resolve(rootDir, 'ssl'))
    ? {
        key: await readFile(resolve(rootDir, 'ssl/privkey.pem')),
        cert: await readFile(resolve(rootDir, 'ssl/cert.pem')),
        ca: await readFile(resolve(rootDir, 'ssl/chain.pem'))
      }
    : null

  const server = fastify({
    https,
    logger: typeof logger === 'undefined' ? { transport: { target: 'pino-pretty' } } : logger,
    forceCloseConnections: true
  })

  await server.register(fastifyHttpErrorsEnhanced, { handle404Errors: false })

  const talks = await getTalks()
  server.decorate('talks', talks)
  server.decorate('syncEmitters', Object.fromEntries([...talks].map(t => [t, new Set()])))

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
    url: '/:talk',
    handler: talkHandler
  })

  server.route({
    method: 'GET',
    url: '/:talk/sync',
    handler: syncHandler
  })

  server.route({
    method: 'POST',
    url: '/:talk/sync/:slide(^\\d+)',
    handler: updateSyncHandler,
    schema: {
      response: {
        [NO_CONTENT]: {},
        [BAD_REQUEST]: badRequestSchema
      }
    }
  })

  server.route({
    method: 'GET',
    url: '/:talk/:slide(^\\d+)',
    handler: talkHandler
  })

  await server.register(fastifyStatic, {
    root: resolve(rootDir, 'dist/html')
  })

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

      resolve(server)
    })
  })
}
