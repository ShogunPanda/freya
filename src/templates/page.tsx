import { type VNode } from 'preact'
import { render } from 'preact-render-to-string'
import { resolveImageUrl } from '../slidesets/loaders.js'
import { type Talk, type Theme } from '../slidesets/models.js'

interface PageProps {
  theme: Theme
  talk: Talk
  talkImages: string[]
  themeImages: string[]
  js: string
  title: string
  bodyClassName?: string
  messageClassName?: string
  body?: string
}

export function page({
  theme,
  talk,
  talkImages,
  themeImages,
  js,
  title,
  body,
  bodyClassName,
  messageClassName
}: PageProps): VNode {
  const { fonts, id } = theme

  const faviconImageUrl = resolveImageUrl({}, id, talk.id, '@theme/favicon.webp')

  if (!body) {
    body = render(<h1 className={messageClassName}>Loading ...</h1>)
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
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
        <script defer={true} type="module" dangerouslySetInnerHTML={{ __html: js }} />
      </head>
      <body className={bodyClassName} dangerouslySetInnerHTML={{ __html: body }} />
    </html>
  )
}
