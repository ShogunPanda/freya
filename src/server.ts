import { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { createHmac } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pusherConfig } from './configuration.js'

interface TalkHandlerParams {
  talk: string
  slide: string
}

function pageExists(server: FastifyInstance, page: string): boolean {
  return existsSync(resolve(server.rootDir, `${page}.html`))
}

export function pusherAuthHandler(request: FastifyRequest, reply: FastifyReply): void {
  const { key, secret } = pusherConfig!

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

export function talkHandler(
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

export function assetsHandler(
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

  void reply.sendFile(`${talk}_assets.html`)
}
