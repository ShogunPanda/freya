import fastifyFormBody from '@fastify/formbody'
import { type ServerResult } from '@perseveranza-pets/dante'
import { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { createHmac } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pusherConfig } from './configuration.js'
interface TalkHandlerParams {
  Params: {
    talk: string
    slide: string
    id: string
  }
  Querystring: {
    export?: string
  }
}

function pageExists(server: FastifyInstance, page: string): boolean {
  return existsSync(resolve(server.rootDir, `${page}.html`))
}

export function pusherAuthHandler(request: FastifyRequest, reply: FastifyReply): void {
  const { key, secret } = pusherConfig!

  const { socket_id: socket, channel_name: channel } = request.body as Record<string, string>

  const user = JSON.stringify({ id: 'freya-sync-guest' })
  const stringToSign = `${socket}:${channel}`
  const signature = createHmac('sha256', secret).update(stringToSign).digest().toString('hex')

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  reply.send({
    auth: `${key}:${signature}`,
    user_data: user
  })
}

export async function talkHandler(
  this: FastifyInstance,
  request: FastifyRequest<TalkHandlerParams>,
  reply: FastifyReply
): Promise<void> {
  const talk = request.params.talk

  if (talk === '404.html' || talk === '__status.html' || !pageExists(this, talk)) {
    return reply.code(404).sendFile('404.html')
  }

  return reply.sendFile(`${talk}.html`)
}

export function assetsHandler(
  this: FastifyInstance,
  request: FastifyRequest<TalkHandlerParams>,
  reply: FastifyReply
): void {
  const talk = request.params.talk

  if (talk === '404.html' || talk === '__status.html' || !pageExists(this, talk)) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    reply.code(404).sendFile('404.html')
    return
  }

  void reply.sendFile(`${talk}_assets.html`)
}

export function setupServer(server: FastifyInstance, isProduction: boolean): ServerResult {
  if (pusherConfig) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    server.register(fastifyFormBody)

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

  return { directory: 'html' }
}
