import fastifyStatic from '@fastify/static'
import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pino from 'pino'
import { getTalks, rootDir } from '../generation/loader.js'

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

  server.decorate('talks', new Set(await getTalks()))

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
