import { serializeCSSClasses, type BuildContext } from '@perseveranza-pets/dante'
import { type VNode } from 'preact'
import { render } from 'preact-render-to-string'
import { resolveImageUrl } from '../slidesets/loaders.js'
import { type Talk, type Theme } from '../slidesets/models.js'

interface HeaderProps {
  context: BuildContext
  theme: Theme
  talk: Talk
  talkImages: string[]
  themeImages: string[]
  js: string
}

export function header({ context, theme, talk, talkImages, themeImages, js }: HeaderProps): VNode {
  const { fonts, id } = theme

  const faviconImageUrl = resolveImageUrl({}, id, talk.id, '@theme/favicon.webp')

  return (
    <>
      <meta name="author" content={talk.document.author.name} />
      <meta name="description" content={talk.document.title} />
      <link rel="icon" href={faviconImageUrl} type="image/webp" sizes="192x192" />
      <link rel="apple-touch-icon" type="image/webp" href={faviconImageUrl} />
      {fonts.urls.map((url: string, index: number) => (
        <link key={index} rel="preload" as="font" href={url} crossOrigin="anonymous" />
      ))}
      {[...themeImages, ...talkImages].map(url => (
        <link key={url} rel="preload" as="image" href={resolveImageUrl({}, id, talk.id, url)} />
      ))}
      <style {...serializeCSSClasses(context)} />
      <script defer={true} type="module" dangerouslySetInnerHTML={{ __html: js }} />
    </>
  )
}

export function page(
  title: string,
  head: VNode,
  bodyClassName?: string,
  messageClassName?: string,
  body?: string
): VNode {
  if (!body) {
    body = render(<h1 className={messageClassName}>Loading ...</h1>)
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {head}
      </head>
      <body className={bodyClassName} dangerouslySetInnerHTML={{ __html: body }} />
    </html>
  )
}
