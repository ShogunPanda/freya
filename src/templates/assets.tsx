import { serializeCSSClasses, type BuildContext } from '@perseveranza-pets/dante'
import { type VNode } from 'preact'
import { type Talk } from '../slidesets/models.js'

interface BodyProps {
  context: BuildContext
  talk: Talk
  talkAssets: [string, string][]
  themeAssets: [string, string][]
}

export function body({ context, talk, talkAssets, themeAssets }: BodyProps): VNode {
  const resolveClasses = context.extensions.freya.resolveClasses

  return (
    <main className={resolveClasses('freya@assets')}>
      <h1 className={resolveClasses('freya@assets__title')}>{talk.document.title}</h1>

      {talkAssets.length > 0 && (
        <>
          <h2 className={resolveClasses('freya@assets__header')}>Talk Assets</h2>

          <section className={resolveClasses('freya@assets__section')}>
            {talkAssets.map(([path, url]) => {
              return (
                <figure
                  key={path}
                  className={resolveClasses('freya@assets__figure')}
                  data-freya-asset-id={`@talk/${path}`}
                >
                  <div className={resolveClasses('freya@assets__figure__image-wrapper')}>
                    <img src={url} className={resolveClasses('freya@assets__figure__image')} />
                  </div>
                  <figcaption className={resolveClasses('freya@assets__figure__caption')}>{path}</figcaption>
                </figure>
              )
            })}
          </section>
        </>
      )}

      {themeAssets.length > 0 && (
        <>
          <h2 className={resolveClasses('freya@assets__header', talkAssets.length > 0 && 'freya@assets__header--next')}>
            Theme Assets
          </h2>

          <section className={resolveClasses('freya@assets__section')}>
            {themeAssets.map(([path, url]) => {
              return (
                <figure
                  key={path}
                  className={resolveClasses('freya@assets__figure')}
                  data-freya-asset-id={`@theme/${path}`}
                >
                  <div className={resolveClasses('freya@assets__figure__image-wrapper')}>
                    <img src={url} className={resolveClasses('freya@assets__figure__image')} />
                  </div>
                  <figcaption className={resolveClasses('freya@assets__figure__caption')}>{path}</figcaption>
                </figure>
              )
            })}
          </section>
        </>
      )}
    </main>
  )
}

export function page(context: BuildContext, bodyClassName: string): VNode {
  const copyAssetScript = `
    document.addEventListener('DOMContentLoaded', () => {
      for (const link of document.querySelectorAll('[data-freya-asset-id]')) {
        link.addEventListener('click', e => {
          e.preventDefault()

          navigator.clipboard.writeText(e.currentTarget.getAttribute('data-freya-asset-id')).catch(console.error)
        }, false)
      }
    })
  `

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
        <style {...serializeCSSClasses(context)} />
        <script dangerouslySetInnerHTML={{ __html: copyAssetScript }} />
      </head>
      <body className={bodyClassName}>@BODY@</body>
    </html>
  )
}
