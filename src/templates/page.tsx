import { serializeCSSClasses, type BuildContext } from 'dante'
import { type ReactNode } from 'react'
import { Presenter } from '../components/presenter.js'
import { SlidesList } from '../components/slides-list.js'
import { CSSClassesResolverContext } from '../index.js'
import { resolveImageUrl } from '../slidesets/loaders.js'
import { type Talk, type Theme } from '../slidesets/models.js'

interface BodyProps {
  context: BuildContext
  slides: ReactNode[]
}

interface HeaderProps {
  context: BuildContext
  talk: Talk
  theme: Theme
  js: string
}

export function body({ context, slides }: BodyProps): JSX.Element {
  const { resolveClasses } = context.extensions.freya

  return (
    <>
      <nav data-freya-id="loading" className={resolveClasses('freya@loading')}>
        <h1 className={resolveClasses('freya@loading__contents')}>Loading ...</h1>
      </nav>

      {slides}

      <CSSClassesResolverContext.Provider value={resolveClasses}>
        <SlidesList context={context} count={slides.length} />
        <Presenter context={context} />
      </CSSClassesResolverContext.Provider>
    </>
  )
}

export function header({ context, talk, theme, js }: HeaderProps): JSX.Element {
  const { fontsUrls, images: themeImages, id } = theme

  const faviconImageUrl = resolveImageUrl(id, talk.id, '@theme/favicon.webp')

  return (
    <>
      <meta name="author" content={talk.document.author.name} />
      <meta name="description" content={talk.document.title} />

      <link rel="icon" href={faviconImageUrl} type="image/webp" sizes="192x192" />
      <link rel="apple-touch-icon" type="image/webp" href={faviconImageUrl} />

      <style {...serializeCSSClasses(context)} />

      {fontsUrls.map(url => (
        <link key={url} rel="preload" as="font" href={url} crossOrigin="anonymous" />
      ))}
      {[...themeImages, ...talk.images].map(url => (
        <link key={url} rel="preload" as="image" href={url} />
      ))}

      <script defer={true} type="module" dangerouslySetInnerHTML={{ __html: js }} />
    </>
  )
}

export function page(title: string): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        @HEAD@
      </head>
      <body>@BODY@</body>
    </html>
  )
}
