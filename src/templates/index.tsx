import type { BuildContext } from '@perseveranza-pets/dante'
import type { VNode } from 'preact'
import type { Talk } from '../slidesets/models.ts'
import { resolve } from 'node:path'
import { cleanCssClasses, danteDir } from '@perseveranza-pets/dante'
import markdownIt from 'markdown-it'
import { isServiceWorkerEnabled } from '../configuration.ts'
import { readFile } from '../fs.ts'
import { getCommon } from '../slidesets/loaders.ts'
import { serviceWorkerRegistration } from './service-workers.ts'

const paragraphMarkdownRenderer = markdownIt({
  html: true,
  linkify: false
})

function parseAbstracts(raw: string): string {
  return paragraphMarkdownRenderer.render(raw).replaceAll(/<a(?:[^>]+)>([^<]+)<\/a>/g, '$1')
}

function niceJoin(array: string[], lastSeparator: string = ' and ', separator: string = ', '): string {
  switch (array.length) {
    case 0:
      return ''
    case 1:
      return array[0]
    case 2:
      return array.join(lastSeparator)
    default:
      return array.slice(0, -1).join(separator) + lastSeparator + array.at(-1)!
  }
}

export async function page(context: BuildContext, talks: Record<string, Talk>, bodyClassName: string): Promise<VNode> {
  const common = await getCommon()
  const authorName = (common.author as Record<string, string>)?.name ?? 'Author'
  const allTalks = Object.entries(talks)
  const currentTalks = allTalks.filter(([, talk]: [string, Talk]) => !talk.document.hidden && !talk.document.archived)
  const archivedTalks = allTalks.filter(([, talk]: [string, Talk]) => !talk.document.hidden && talk.document.archived)

  const siteVersion = `globalThis.__freyaSiteVersion = "${context.version}"`
  const hotReload = !context.isProduction ? await readFile(resolve(danteDir, 'dist/assets/hot-reload.js')) : ''
  const serviceWorker = isServiceWorkerEnabled(context) ? serviceWorkerRegistration('/sw.js') : ''
  const js = [siteVersion, hotReload, serviceWorker].join('\n;\n')

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Slidesets</title>
        {context.extensions.freya.fonts.urls.map((url: string, index: number) => (
          <link key={index} rel="preload" as="font" href={url} crossOrigin="anonymous" />
        ))}
        <script defer={true} type="text/javascript" dangerouslySetInnerHTML={{ __html: js }} />
      </head>
      <body className={bodyClassName}>
        <main className={cleanCssClasses('freya@resources')}>
          <h1 className={cleanCssClasses('title')}>{authorName}'s Slidesets</h1>

          {currentTalks.length > 0 && (
            <>
              <h2 className={cleanCssClasses('header')}>Current Slidesets</h2>

              <section className={cleanCssClasses('slidesets')}>
                {currentTalks.map(([id, talk]) => (
                  <a key={id} href={`/${id}`} className={cleanCssClasses('slideset')}>
                    <h4 className={cleanCssClasses('author')}>
                      {talk.document.authors
                        ? niceJoin(talk.document.authors.map(({ name }: { name: string }) => name) as string[])
                        : talk.document.author.name}
                    </h4>
                    <h3 className={cleanCssClasses('title')}>{talk.document.title}</h3>

                    {talk.document.abstract && (
                      <div
                        className={cleanCssClasses('abstract')}
                        dangerouslySetInnerHTML={{
                          __html: parseAbstracts(talk.document.abstract as string)
                        }}
                      />
                    )}
                  </a>
                ))}
              </section>
            </>
          )}

          {archivedTalks.length > 0 && (
            <>
              <h2 className={cleanCssClasses('header')}>Archived Slidesets</h2>

              <section className={cleanCssClasses('slidesets')}>
                {archivedTalks.map(([id, talk]) => (
                  <a key={id} href={`/${id}`} className={cleanCssClasses('slideset')}>
                    <h4 className={cleanCssClasses('author')}>{talk.document.author.name}</h4>
                    <h3 className={cleanCssClasses('title')}>{talk.document.title}</h3>

                    {talk.document.abstract && (
                      <div
                        className={cleanCssClasses('abstract')}
                        dangerouslySetInnerHTML={{
                          __html: parseAbstracts(talk.document.abstract as string)
                        }}
                      />
                    )}
                  </a>
                ))}
              </section>
            </>
          )}
        </main>
      </body>
    </html>
  )
}
