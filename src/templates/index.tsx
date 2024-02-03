import { danteDir, serializeCSSClasses, type BuildContext } from '@perseveranza-pets/dante'
import { resolve } from 'node:path'
import { Fragment, type VNode } from 'preact'
import { readFile } from '../fs.js'
import { finalizeJs } from '../slidesets/generators.js'
import { type Talk } from '../slidesets/models.js'
import { serviceWorkerRegistration } from '../templates/service-worker.js'

interface BodyProps {
  context: BuildContext
  talks: Record<string, Talk>
}

export function body({ context, talks }: BodyProps): VNode {
  const resolveClasses = context.extensions.freya.resolveClasses
  const allTalks = Object.entries(talks)
  const currentTalks = allTalks.filter(([, talk]: [string, Talk]) => !talk.document.archived)
  const archivedTalks = allTalks.filter(([, talk]: [string, Talk]) => talk.document.archived)

  return (
    <main className={resolveClasses('freya@index')}>
      {currentTalks.length > 0 && (
        <>
          <h1 className={resolveClasses('freya@index__header')}>Current Slidesets</h1>
          {currentTalks.map(([id, talk], index) => (
            <Fragment key={`talk:${id}`}>
              <a
                href={`/${id}`}
                className={resolveClasses('freya@index__talk', index > 0 && 'freya@index__talk--next')}
              >
                {talk.document.title}
              </a>
              <span className={resolveClasses('freya@index__talk__author')}>{talk.document.author.name}</span>
            </Fragment>
          ))}
        </>
      )}

      {archivedTalks.length > 0 && (
        <>
          <h1 className={resolveClasses('freya@index__header', 'freya@index__header--next')}>Archived Slidesets</h1>
          {archivedTalks.map(([id, talk], index) => (
            <Fragment key={`talk:${id}`}>
              <a
                href={`/${id}`}
                className={resolveClasses('freya@index__talk', index > 0 && 'freya@index__talk--next')}
              >
                {talk.document.title}
              </a>
              <span className={resolveClasses('freya@index__talk__author')}>{talk.document.author.name}</span>
            </Fragment>
          ))}
        </>
      )}
    </main>
  )
}

export async function page(context: BuildContext, bodyClassName: string): Promise<VNode> {
  const siteVersion = `globalThis.__freyaSiteVersion = "${context.version}"`
  const hotReload = !context.isProduction ? await readFile(resolve(danteDir, 'dist/assets/hot-reload.js')) : ''

  const serviceWorker = context.isProduction && !context.extensions.freya.export ? serviceWorkerRegistration() : ''

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
        <style {...serializeCSSClasses(context)} />
        <script defer={true} type="text/javascript" dangerouslySetInnerHTML={{ __html: js }} />
      </head>
      <body className={bodyClassName}>@BODY@</body>
    </html>
  )
}
