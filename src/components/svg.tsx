import type { JSX, VNode } from 'preact'
import { useClient } from './contexts.tsx'
import { cleanCssClasses } from './styling.ts'

interface SvgProps extends JSX.SVGAttributes<SVGSVGElement> {
  src: string
  className?: string
}

interface SvgIconProps {
  name: string
  className?: string
}

interface SvgDefinitionsProps {
  definitions: string[]
  className?: string
}

export function generateSVGId(start: number): string {
  let name = ''
  let i = start

  do {
    let index = i % 26
    i = i / 26

    if (start > 0 && index - 1 === -1) {
      index = 26
      i--
    }

    // a = 97 => a + index - 1
    name = String.fromCharCode(index + 97) + name
  } while (i >= 1)

  return `svg:${name}`
}

export function normalizeSVGProps(props: Record<string, string | undefined>): JSX.SVGAttributes<SVGSVGElement> {
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
    strokeLinecap: strokeLinecap as JSX.SVGAttributes<SVGSVGElement>['strokeLinecap'],
    strokeLinejoin: strokeLinejoin as JSX.SVGAttributes<SVGSVGElement>['strokeLinejoin'],
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

export function SvgDefinitions({ definitions, className }: SvgDefinitionsProps): VNode {
  return (
    <svg
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      className={cleanCssClasses('freya@svg-definitions', className)}
    >
      <defs dangerouslySetInnerHTML={{ __html: definitions.join('\n') }} />
    </svg>
  )
}

export function Svg({ src: path, className, ...props }: SvgProps): VNode {
  const {
    talk: { id: talkId },
    theme: { id: themeId },
    resolveSVG
  } = useClient()

  const [id, viewBox] = resolveSVG(themeId, talkId, path)

  return (
    <svg {...props} className={cleanCssClasses('freya@svg', className)} viewBox={viewBox}>
      <use xlinkHref={`#${id}`} />
    </svg>
  )
}

export function SvgCloseIcon(props: JSX.SVGAttributes<SVGSVGElement>): VNode {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="currentColor"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function SvgIcon({ name, className }: SvgIconProps): VNode {
  const { assets } = useClient()

  const [id, viewBox] = assets.svgs[name]

  return (
    <svg className={cleanCssClasses('freya@svg', className)} viewBox={viewBox}>
      <use xlinkHref={`#${id}`} />
    </svg>
  )
}
