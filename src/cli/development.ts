import fastifyStatic from '@fastify/static'
import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { existsSync, watch } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateSlidesets, uncachedImportPrefix } from '../generation/generator.js'
import { getTalks, rootDir } from '../generation/loader.js'

function watchChanges(server: FastifyInstance): void {
  // Watch the talks folder for changes.
  let generating = false

  const talksWatcher = watch(resolve(rootDir, 'src/talks'), { recursive: true }, async (_: string, path: string) => {
    try {
      let talk: string = ''

      // If one of the talks files have been changed, update the talks list
      // Check if the file structure matches
      const components = path.split(sep)

      if (components.at(-1)!.startsWith(uncachedImportPrefix) || generating) {
        return
      }

      if (components.length === 2 && components[1] === 'talk.yml') {
        talk = components[0]

        if (existsSync(resolve(rootDir, 'src/talks', path))) {
          server.talks.add(talk)
        } else {
          server.talks.delete(talk)
        }
      }

      generating = true
      server.slidesets = await generateSlidesets(server)
    } catch (error) {
      server.log.fatal(error)
    } finally {
      generating = false
    }
  })

  // @ts-expect-error
  talksWatcher.unref()

  // Themes and other resources
  for (const folder of ['src/themes']) {
    // When the theme folder changes, regenerate all talks
    const watcher = watch(resolve(rootDir, folder), { recursive: true }, async (_: string, path: string) => {
      try {
        const components = path.split(sep)

        if (components.at(-1)!.startsWith(uncachedImportPrefix)) {
          return
        }

        server.slidesets = await generateSlidesets(server)
      } catch (error) {
        server.log.fatal(error)
      }
    })

    // @ts-expect-error
    watcher.unref()
  }

  process.on('SIGINT', () => {
    server.close().catch(console.error)
  })
}

interface TalkHandlerParams {
  talk: string
  slide: string
}

function talkHandler(
  this: FastifyInstance,
  request: FastifyRequest<{ Params: TalkHandlerParams }>,
  reply: FastifyReply
): void {
  const id = request.params.talk

  if (!this.talks.has(id)) {
    reply.callNotFound()
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  reply.type('text/html').send(this.slidesets[id])
}

const page404 = await readFile(fileURLToPath(new URL('../assets/404.html', import.meta.url)))

export async function developmentServer(ip: string, port: number, logging: boolean = true): Promise<FastifyInstance> {
  const server = fastify({
    logger: logging ? { transport: { target: 'pino-pretty' } } : false,
    forceCloseConnections: true
  })

  server.decorate('talks', await getTalks())

  server.route({
    method: 'GET',
    url: '/',
    handler(this: FastifyInstance, _: FastifyRequest, reply: FastifyReply): void {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      reply.type('text/html').send(this.slidesets.index)
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
    prefix: '/assets/talks',
    root: resolve(rootDir, 'src/talks'),
    decorateReply: false
  })

  await server.register(fastifyStatic, {
    prefix: '/assets/themes',
    root: resolve(rootDir, 'src/themes'),
    decorateReply: false
  })

  server.setNotFoundHandler(function (_: FastifyRequest, reply: FastifyReply) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    reply.type('text/html').send(page404)
  })

  process.on('SIGINT', () => server.close())

  watchChanges(server)
  server.slidesets = await generateSlidesets(server)

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
