import { type SVGProps } from 'react'
import { js2xml, xml2js } from 'xml-js'

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

export function normalizeSVGProps(props: Record<string, string | undefined>): SVGProps<SVGSVGElement> {
  const {
    viewBox,
    version,
    style: rawStyle,
    class: className,
    'stroke-width': strokeWidth,
    stroke,
    fill,
    'stroke-linecap': strokeLinecap,
    'stroke-linecap': strokeLinejoin
  } = props

  // Camelcase some props and all the styles
  return {
    viewBox,
    version,
    stroke,
    strokeWidth,
    strokeLinecap: strokeLinecap as SVGProps<SVGSVGElement>['strokeLinecap'],
    strokeLinejoin: strokeLinejoin as SVGProps<SVGSVGElement>['strokeLinejoin'],
    fill,
    style: Object.fromEntries(
      (rawStyle ?? '')
        .split(';')
        .map(s => {
          const [k, v] = s.split(':')

          // Camelcase the key
          return [k.replaceAll(/-(.)/g, ([, c]) => c.toUpperCase()), v]
        })
        .filter(e => e[0])
    ),
    className
  }
}
