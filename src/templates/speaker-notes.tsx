import { serializeCSSClasses, type BuildContext, type CSSClassesResolver } from '@perseveranza-pets/dante'
import { Fragment, type VNode } from 'preact'
import { renderNotes } from '../slidesets/generators.js'
import { type Talk } from '../slidesets/models.js'

interface BodyProps {
  talk: Talk
  resolveClasses: CSSClassesResolver
}

export function body({ talk, resolveClasses }: BodyProps): VNode {
  return (
    <main className={resolveClasses('freya@speaker-notes')}>
      <h2 className={resolveClasses('freya@speaker-notes__subtitle')}>Speaker Notes</h2>
      <h1>{talk.document.title}</h1>

      {talk.slides.map((s, index) => {
        if (!s.notes || s.notes.length === 0) {
          return undefined
        }

        return (
          <Fragment key={index}>
            <h3 className={resolveClasses('freya@speaker-notes__slide')}>
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
        <link
          rel="preload"
          as="font"
          crossOrigin="anonymous"
          href="https://fonts.gstatic.com/s/varelaround/v20/w8gdH283Tvk__Lua32TysjIfp8uPLdshZg.woff2"
        />

        <style {...serializeCSSClasses(context)} />
      </head>
      <body className={bodyClassName}>@BODY@</body>
    </html>
  )
}
