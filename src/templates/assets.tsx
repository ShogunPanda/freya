import { serializeCSSClasses, type BuildContext } from '@perseveranza-pets/dante'
import { type VNode } from 'preact'
import { resolveImageUrl } from '../index.js'
import { type Talk, type Theme } from '../slidesets/models.js'

interface BodyProps {
  context: BuildContext
  theme: Theme
  talk: Talk
  talkImages: string[]
  themeImages: string[]
}

export function body({ context, theme, talk, talkImages, themeImages }: BodyProps): VNode {
  const resolveClasses = context.extensions.freya.resolveClasses

  return (
    <main className={resolveClasses('freya@assets')}>
      <h1 className={resolveClasses('freya@assets__title')}>{talk.document.title}</h1>

      {talkImages.length > 0 && (
        <>
          <h2 className={resolveClasses('freya@assets__header')}>Talk Assets</h2>

          <section className={resolveClasses('freya@assets__section')}>
            {talkImages.map(path => {
              return (
                <figure key={path} className={resolveClasses('freya@assets__figure')} data-freya-asset-id={path}>
                  <div className={resolveClasses('freya@assets__figure__image-wrapper')}>
                    <img
                      src={resolveImageUrl({}, theme.id, talk.id, path)}
                      className={resolveClasses('freya@assets__figure__image')}
                    />
                  </div>
                  <figcaption className={resolveClasses('freya@assets__figure__caption')}>{path}</figcaption>
                </figure>
              )
            })}
          </section>
        </>
      )}

      {themeImages.length > 0 && (
        <>
          <h2 className={resolveClasses('freya@assets__header', talkImages.length > 0 && 'freya@assets__header--next')}>
            Theme Assets
          </h2>

          <section className={resolveClasses('freya@assets__section')}>
            {themeImages.map(path => {
              return (
                <figure key={path} className={resolveClasses('freya@assets__figure')} data-freya-asset-id={path}>
                  <div className={resolveClasses('freya@assets__figure__image-wrapper')}>
                    <img
                      src={resolveImageUrl({}, theme.id, talk.id, path)}
                      className={resolveClasses('freya@assets__figure__image')}
                    />
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
        {context.extensions.freya.fonts.urls.map((url: string, index: number) => (
          <link key={index} rel="preload" as="font" href={url} crossOrigin="anonymous" />
        ))}
        <style {...serializeCSSClasses(context)} />
        <script dangerouslySetInnerHTML={{ __html: copyAssetScript }} />
      </head>
      <body className={bodyClassName}>@BODY@</body>
    </html>
  )
}
