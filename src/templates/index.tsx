import { danteDir, serializeCSSClasses, type BuildContext } from 'dante'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Fragment } from 'react'
import { finalizeJs } from '../slidesets/generators.js'
import { type Talk } from '../slidesets/models.js'

interface BodyProps {
  context: BuildContext
  talks: Record<string, Talk>
}

export function body({ context, talks }: BodyProps): JSX.Element {
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

export async function page(context: BuildContext, bodyClassName: string): Promise<JSX.Element> {
  const siteVersion = `globalThis.__freyaSiteVersion = "${context.version}"`
  const hotReload = !context.isProduction ? await readFile(resolve(danteDir, 'dist/assets/hot-reload.js'), 'utf8') : ''

  const serviceWorker = context.isProduction
    ? await readFile(fileURLToPath(new URL('../assets/js/service-worker.js', import.meta.url)), 'utf8')
    : ''

  const js = await finalizeJs([siteVersion, hotReload, serviceWorker].join('\n;\n'))

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Slidesets</title>
        <link
          rel="preload"
          as="font"
          crossOrigin="anonymous"
          href="https://fonts.gstatic.com/s/varelaround/v20/w8gdH283Tvk__Lua32TysjIfp8uPLdshZg.woff2"
        />
        <script defer={true} type="text/javascript" dangerouslySetInnerHTML={{ __html: js }} />
        <style {...serializeCSSClasses(context)} />
      </head>
      <body className={bodyClassName}>@BODY@</body>
    </html>
  )
}
