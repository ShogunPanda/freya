import type { ParsedSVG } from '../slidesets/models.ts'
import { readFileSync } from 'node:fs'
import { render } from 'preact-render-to-string'
import { js2xml, xml2js } from 'xml-js'
import { generateSVGId, normalizeSVGProps } from '../components/svg.tsx'
import { resolveImagePath } from '../slidesets/loaders.ts'

export function parseSVG(raw: string): [Record<string, string | undefined>, string] {
  // Open the the file and parse as XML
  const parsedContent = xml2js(raw)

  // Find the root element
  const root = parsedContent.elements.find((e: { name: string }) => e.name === 'svg')

  // Remove unwanted attributes
  const attrs = root.attributes
  attrs.xmlns = undefined
  attrs.width = undefined
  attrs.height = undefined

  return [
    attrs,
    js2xml({ elements: root.elements }) // Reserialize children without processing
  ]
}

export function resolveSVG(
  definitions: string[],
  cache: Record<string, ParsedSVG>,
  theme: string,
  talk: string,
  path?: string
): ParsedSVG {
  path = path?.toString()
  const key = `${theme}:${talk}:${path}`

  if (!path) {
    return ['', '']
  } else if (cache[key]) {
    return cache[key]
  }

  // Resolve the path
  const resolvedPath = resolveImagePath({}, theme, talk, path)

  // Open the the file and parse as XML
  const parsedContent = xml2js(readFileSync(resolvedPath, 'utf-8'))

  // Find the root element
  const root = parsedContent.elements.find((e: { name: string }) => e.name === 'svg')

  // Remove unwanted attributes
  const attrs: Record<string, string | undefined> = root.attributes
  attrs.xmlns = undefined
  attrs.width = undefined
  attrs.height = undefined

  // Generate the ID
  const id = generateSVGId(definitions.length)
  cache[key] = [id, attrs.viewBox ?? '']

  definitions.push(
    render(
      <svg
        id={id}
        {...normalizeSVGProps(attrs)}
        dangerouslySetInnerHTML={{ __html: js2xml({ elements: root.elements }) }}
      />
    )
  )

  return cache[key]
}
