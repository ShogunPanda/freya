import { serializeCSSClasses, type BuildContext } from '@perseveranza-pets/dante'
import { type VNode } from 'preact'

interface BodyProps {
  context: BuildContext
}

export function body({ context }: BodyProps): VNode {
  const resolveClasses = context.extensions.freya.resolveClasses

  return (
    <main className={resolveClasses('freya@page404')}>
      <h1>Not Found (HTTP 404)</h1>
      <h3 className={resolveClasses('freya@page404__subtitle')}>
        The page you are looking for doesn't exist or never existed.
      </h3>
      <p className={resolveClasses('freya@page404__cta')}>If you think the page should be there, please let us know.</p>
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
        <style {...serializeCSSClasses(context)} />
      </head>
      <body className={bodyClassName}>@BODY@</body>
    </html>
  )
}