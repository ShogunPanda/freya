import type { BuildContext } from '@perseveranza-pets/dante'
import type { VNode } from 'preact'
import type { Talk } from '../slidesets/models.ts'
import { cleanCssClasses } from '@perseveranza-pets/dante'
import { Fragment } from 'preact'
import { renderNotes } from '../slidesets/generators.tsx'

interface BodyProps {
  talk: Talk
}

export function body({ talk }: BodyProps): VNode {
  return (
    <main className={cleanCssClasses('freya@speaker-notes')}>
      <h2 className={cleanCssClasses('freya@speaker-subtitle')}>Speaker Notes</h2>
      <h1>{talk.document.title}</h1>

      {talk.slides.map((s, index) => {
        if (!s.notes || s.notes.length === 0) {
          return undefined
        }

        return (
          <Fragment key={index}>
            <h3 className={cleanCssClasses('freya@speaker-slide')}>
              Slide {(index + 1).toString().padStart(talk.slidesPadding, '0')}/{talk.slidesCount}: &nbsp;
              <span
                dangerouslySetInnerHTML={{
                  __html: s.title ?? (s.layout ?? 'default').replaceAll(/((?:^.)|(?:\s.))/g, (_u, m) => m.toUpperCase())
                }}
              />
            </h3>

            <div dangerouslySetInnerHTML={{ __html: renderNotes(s) }} />
          </Fragment>
        )
      })}
    </main>
  )
}

export function page(context: BuildContext, bodyClassName: string): VNode {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Slidesets</title>
        {context.extensions.freya.fonts.urls.map((url: string, index: number) => (
          <link key={index} rel="preload" as="font" href={url} crossOrigin="anonymous" />
        ))}
      </head>
      <body className={bodyClassName}>@BODY@</body>
    </html>
  )
}
