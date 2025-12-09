import type { BuildContext } from '@perseveranza-pets/dante'
import type { VNode } from 'preact'
import type { Talk, Theme } from '../slidesets/models.ts'
import { cleanCssClasses } from '@perseveranza-pets/dante'
import { resolveImageUrl } from '../index.ts'

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
          <h1 className={cleanCssClasses('title')}>{talk.document.title}</h1>

          {talkImages.length > 0 && (
            <>
              <h2 className={cleanCssClasses('header')}>Talk Assets</h2>

              <section className={cleanCssClasses('section')}>
                {talkImages.map(path => {
                  return (
                    <figure key={path} className={cleanCssClasses('figure')} data-freya-asset-id={path}>
                      <div className={cleanCssClasses('image-wrapper')}>
                        <img src={resolveImageUrl({}, theme.id, talk.id, path)} className={cleanCssClasses('image')} />
                      </div>
                      <figcaption className={cleanCssClasses('caption')}>{path}</figcaption>
                    </figure>
                  )
                })}
              </section>
            </>
          )}

          {themeImages.length > 0 && (
            <>
              <h2 className={cleanCssClasses('header', talkImages.length > 0 && 'next')}>Theme Assets</h2>

              <section className={cleanCssClasses('section')}>
                {themeImages.map(path => {
                  return (
                    <figure key={path} className={cleanCssClasses('figure')} data-freya-asset-id={path}>
                      <div className={cleanCssClasses('image-wrapper')}>
                        <img src={resolveImageUrl({}, theme.id, talk.id, path)} className={cleanCssClasses('image')} />
                      </div>
                      <figcaption className={cleanCssClasses('caption')}>{path}</figcaption>
                    </figure>
                  )
                })}
              </section>
            </>
          )}

          {commonImages.length > 0 && (
            <>
              <h2 className={cleanCssClasses('header', (talkImages.length > 0 || themeImages.length > 0) && 'next')}>
                Common Assets
              </h2>

              <section className={cleanCssClasses('section')}>
                {commonImages.map(path => {
                  return (
                    <figure key={path} className={cleanCssClasses('figure')} data-freya-asset-id={path}>
                      <div className={cleanCssClasses('image-wrapper')}>
                        <img src={resolveImageUrl({}, theme.id, talk.id, path)} className={cleanCssClasses('image')} />
                      </div>
                      <figcaption className={cleanCssClasses('caption')}>{path}</figcaption>
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
