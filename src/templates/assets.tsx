import { cleanCssClasses, type BuildContext } from '@perseveranza-pets/dante'
import { type VNode } from 'preact'
import { resolveImageUrl } from '../index.ts'
import { type Talk, type Theme } from '../slidesets/models.ts'

interface AssetsProps {
  context: BuildContext
  theme: Theme
  talk: Talk
  commonImages: string[]
  themeImages: string[]
  talkImages: string[]
  bodyClassName: string
}

export function page({
  context,
  theme,
  talk,
  commonImages,
  themeImages,
  talkImages,
  bodyClassName
}: AssetsProps): VNode {
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
        <script dangerouslySetInnerHTML={{ __html: copyAssetScript }} />
      </head>
      <body className={bodyClassName}>
        <main className={cleanCssClasses('freya@resources')}>
          <h1 className={cleanCssClasses('freya@resources__title')}>{talk.document.title}</h1>

          {talkImages.length > 0 && (
            <>
              <h2 className={cleanCssClasses('freya@resources__header')}>Talk Assets</h2>

              <section className={cleanCssClasses('freya@resources__section')}>
                {talkImages.map(path => {
                  return (
                    <figure
                      key={path}
                      className={cleanCssClasses('freya@resources__figure')}
                      data-freya-asset-id={path}
                    >
                      <div className={cleanCssClasses('freya@resources__figure__image-wrapper')}>
                        <img
                          src={resolveImageUrl({}, theme.id, talk.id, path)}
                          className={cleanCssClasses('freya@resources__figure__image')}
                        />
                      </div>
                      <figcaption className={cleanCssClasses('freya@resources__figure__caption')}>{path}</figcaption>
                    </figure>
                  )
                })}
              </section>
            </>
          )}

          {themeImages.length > 0 && (
            <>
              <h2
                className={cleanCssClasses(
                  'freya@resources__header',
                  talkImages.length > 0 && 'freya@resources__header--next'
                )}
              >
                Theme Assets
              </h2>

              <section className={cleanCssClasses('freya@resources__section')}>
                {themeImages.map(path => {
                  return (
                    <figure
                      key={path}
                      className={cleanCssClasses('freya@resources__figure')}
                      data-freya-asset-id={path}
                    >
                      <div className={cleanCssClasses('freya@resources__figure__image-wrapper')}>
                        <img
                          src={resolveImageUrl({}, theme.id, talk.id, path)}
                          className={cleanCssClasses('freya@resources__figure__image')}
                        />
                      </div>
                      <figcaption className={cleanCssClasses('freya@resources__figure__caption')}>{path}</figcaption>
                    </figure>
                  )
                })}
              </section>
            </>
          )}

          {commonImages.length > 0 && (
            <>
              <h2
                className={cleanCssClasses(
                  'freya@resources__header',
                  (talkImages.length > 0 || themeImages.length > 0) && 'freya@resources__header--next'
                )}
              >
                Common Assets
              </h2>

              <section className={cleanCssClasses('freya@resources__section')}>
                {commonImages.map(path => {
                  return (
                    <figure
                      key={path}
                      className={cleanCssClasses('freya@resources__figure')}
                      data-freya-asset-id={path}
                    >
                      <div className={cleanCssClasses('freya@resources__figure__image-wrapper')}>
                        <img
                          src={resolveImageUrl({}, theme.id, talk.id, path)}
                          className={cleanCssClasses('freya@resources__figure__image')}
                        />
                      </div>
                      <figcaption className={cleanCssClasses('freya@resources__figure__caption')}>{path}</figcaption>
                    </figure>
                  )
                })}
              </section>
            </>
          )}
        </main>
      </body>
    </html>
  )
}
