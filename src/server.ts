import fastifyFormBody from '@fastify/formbody'
import { type ServerResult } from '@perseveranza-pets/dante'
import { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { NOT_FOUND } from 'http-errors-enhanced'
import { createHmac } from 'node:crypto'
import { existsSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { pusherConfig } from './configuration.js'
import { getTalk, resolveImagePath } from './index.js'

interface TalkHandlerParams {
  Params: {
    talk: string
    slide: string
  }
}

interface AssetsHandlerParams {
  Params: {
    talk: string
    type: 'talk' | 'theme'
    '*': string
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
  const { talk, slide } = request.params

  if (talk === '404.html' || talk === '__status.html' || !pageExists(this, talk)) {
    return reply.code(NOT_FOUND).sendFile('404.html')
  }

  if (slide) {
    if (slide === 'sw.js') {
      return reply.sendFile(`assets/talks/${talk}/sw.js`)
    } else if (!slide.match(/^\d+$/)) {
      return reply.code(NOT_FOUND).sendFile('404.html')
    }
  }

  return reply.sendFile(`${talk}.html`)
}

export async function assetsHandler(
  this: FastifyInstance,
  request: FastifyRequest<AssetsHandlerParams>,
  reply: FastifyReply
): Promise<void> {
  const { talk, type, '*': path } = request.params

  if (!type) {
    return reply.sendFile(`${talk}_assets.html`)
  } else if (!['common', 'theme', 'talk'].includes(type)) {
    return reply.code(NOT_FOUND).sendFile('404.html')
  }

  const {
    config: { theme }
  } = await getTalk(talk)

  const finalPath = resolveImagePath({}, theme, talk, `@${type}/${path}`)
  const finalPathDirname = dirname(finalPath)
  const finalPathBasename = basename(finalPath)

  return reply.sendFile(finalPathBasename, finalPathDirname)
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
    url: '/:talk/assets/:type/*',
    handler: assetsHandler
  })

  server.route({
    method: 'GET',
    url: '/:talk/:slide',
    handler: talkHandler
  })

  return { directory: 'html' }
}
