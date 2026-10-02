import type { VNode } from 'preact'
import type { Talk, Theme } from '../slidesets/models.ts'
import { resolveImageUrl } from '../slidesets/loaders.ts'

interface PageProps {
  theme: Theme
  talk: Talk
  talkImages: string[]
  themeImages: string[]
  commonImages: string[]
  js: string
  title: string
  bodyClassName?: string
  messageClassName?: string
  body?: string
  fontUrls?: string[]
  exporting?: boolean
}

export function page({
  theme,
  talk,
  js,
  title,
  body = '',
  bodyClassName,
  fontUrls = [],
  exporting = false
}: PageProps): VNode {
  const { id } = theme

  const faviconImageUrl = resolveImageUrl({}, id, talk.id, '@theme/favicon.webp', exporting)

  const fonts = new Set([...fontUrls, ...theme.fonts.urls])

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
        {[...fonts].map(url => (
          <link key={url} rel="preload" as="font" href={url} crossOrigin="anonymous" />
        ))}
        <script defer={true} type="module" dangerouslySetInnerHTML={{ __html: js }} />
      </head>
      <body className={bodyClassName} dangerouslySetInnerHTML={{ __html: body }} />
    </html>
  )
}
