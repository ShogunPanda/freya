import { cleanCssClasses, danteDir, type BuildContext } from '@perseveranza-pets/dante'
import markdownIt from 'markdown-it'
import { resolve } from 'node:path'
import { type VNode } from 'preact'
import { isServiceWorkerEnabled } from '../configuration.js'
import { readFile } from '../fs.js'
import { finalizeJs } from '../slidesets/generators.js'
import { getCommon } from '../slidesets/loaders.js'
import { type Talk } from '../slidesets/models.js'
import { serviceWorkerRegistration } from './service-workers.js'

const paragraphMarkdownRenderer = markdownIt({
  html: true,
  linkify: false
})

function parseAbstracts(raw: string): string {
  return paragraphMarkdownRenderer.render(raw).replaceAll(/<a(?:[^>]+)>([^<]+)<\/a>/g, '$1')
}

export async function page(context: BuildContext, talks: Record<string, Talk>, bodyClassName: string): Promise<VNode> {
  const common = await getCommon()
  const authorName = (common.author as Record<string, string>)?.name ?? 'Author'
  const allTalks = Object.entries(talks)
  const currentTalks = allTalks.filter(([, talk]: [string, Talk]) => !talk.document.archived)
  const archivedTalks = allTalks.filter(([, talk]: [string, Talk]) => talk.document.archived)

  const siteVersion = `globalThis.__freyaSiteVersion = "${context.version}"`
  const hotReload = !context.isProduction ? await readFile(resolve(danteDir, 'dist/assets/hot-reload.js')) : ''
  const serviceWorker = isServiceWorkerEnabled(context) ? serviceWorkerRegistration('/sw.js') : ''
  const js = await finalizeJs([siteVersion, hotReload, serviceWorker].join('\n;\n'))

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
          <h1 className={cleanCssClasses('freya@resources__title')}>{authorName}'s Slidesets</h1>

          {currentTalks.length > 0 && (
            <>
              <h2 className={cleanCssClasses('freya@resources__header')}>Current Slidesets</h2>

              <section className={cleanCssClasses('freya@resources__slidesets')}>
                {currentTalks.map(([id, talk]) => (
                  <a href={`/${id}`} className={cleanCssClasses('freya@resources__slideset')}>
                    <h4 className={cleanCssClasses('freya@resources__slideset__author')}>
                      {talk.document.author.name}
                    </h4>
                    <h3 className={cleanCssClasses('freya@resources__slideset__title')}>{talk.document.title}</h3>

                    {talk.document.abstract && (
                      <div
                        className={cleanCssClasses('freya@resources__slideset__abstract')}
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
              <h2 className={cleanCssClasses('freya@resources__header')}>Archived Slidesets</h2>

              <section className={cleanCssClasses('freya@resources__slidesets')}>
                {archivedTalks.map(([id, talk]) => (
                  <a href={`/${id}`} className={cleanCssClasses('freya@resources__slideset')}>
                    <h4 className={cleanCssClasses('freya@resources__slideset__author')}>
                      {talk.document.author.name}
                    </h4>
                    <h3 className={cleanCssClasses('freya@resources__slideset__title')}>{talk.document.title}</h3>

                    {talk.document.abstract && (
                      <div
                        className={cleanCssClasses('freya@resources__slideset__abstract')}
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
