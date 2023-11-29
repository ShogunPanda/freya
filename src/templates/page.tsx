import { type BuildContext } from 'dante'
import { type ReactNode } from 'react'
import { Presenter } from '../components/presenter.js'
import { SlidesList } from '../components/slides-list.js'
import { resolveImageUrl } from '../slidesets/loaders.js'
import { type Talk, type Theme } from '../slidesets/models.js'

interface BodyProps {
  context: BuildContext
  slides: ReactNode[]
}

interface HeaderProps {
  talk: Talk
  theme: Theme
  css: string
  js: string
}

export function body({ context, slides }: BodyProps): JSX.Element {
  return (
    <>
      <nav data-freya-id="loading" className={context.extensions.expandClasses('freya@loading')}>
        <h1 className={context.extensions.expandClasses('freya@loading__contents')}>Loading ...</h1>
      </nav>

      {slides}

      <SlidesList context={context} count={slides.length} />
      <Presenter context={context} />
    </>
  )
}

export function header({ talk, theme, css, js }: HeaderProps): JSX.Element {
  const { fontsUrls, images: themeImages, id } = theme

  const faviconImageUrl = resolveImageUrl(id, talk.id, '@theme/favicon.webp')

  return (
    <>
      <meta name="author" content={talk.document.author.name} />
      <meta name="description" content={talk.document.title} />

      <link rel="icon" href={faviconImageUrl} type="image/webp" sizes="192x192" />
      <link rel="apple-touch-icon" type="image/webp" href={faviconImageUrl} />

      <style data-dante-placeholder="style" dangerouslySetInnerHTML={{ __html: css }} />

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
