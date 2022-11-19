import fastifyStatic from '@fastify/static'
import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { resolve } from 'node:path'
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

export async function localServer(directory: string, ip: string, port: number): Promise<FastifyInstance> {
  const server = fastify({
    logger: {
      transport: { target: 'pino-pretty' }
    }
  })

  server.decorate('talks', new Set(await getTalks()))

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
    root: resolve(rootDir, directory)
  })

  server.setNotFoundHandler(function (_: FastifyRequest, reply: FastifyReply) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    reply.sendFile('404.html')
  })

  process.on('SIGINT', () => server.close())

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
