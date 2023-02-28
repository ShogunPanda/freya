import fastifyFormBody from '@fastify/formbody'
import fastifyStatic from '@fastify/static'
import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fastifyHttpErrorsEnhanced from 'fastify-http-errors-enhanced'
import { createHmac } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pino from 'pino'
import { getTalks, pusherConfig, rootDir } from '../generation/loader.js'

interface TalkHandlerParams {
  talk: string
  slide: string
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

export async function localServer(
  ip: string,
  port: number,
  logger?: pino.Logger | false,
  staticDir: string = 'dist/html'
): Promise<FastifyInstance> {
  const fullOutput = resolve(rootDir, staticDir)
  await mkdir(fullOutput, { recursive: true })

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
  await server.register(fastifyFormBody)

  const talks = await getTalks()
  server.decorate('talks', talks)

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
    url: '/:talk',
    handler: talkHandler
  })

  server.route({
    method: 'GET',
    url: '/:talk/:slide(^\\d+)',
    handler: talkHandler
  })

  await server.register(fastifyStatic, {
    root: resolve(rootDir, staticDir)
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
