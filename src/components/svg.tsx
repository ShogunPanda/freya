import { readFileSync } from 'node:fs'
import { SVGProps } from 'react'
import { resolveImagePath } from '../generation/loader.js'
import { normalizeSVGProps, parseSVG } from '../generation/svg.js'

interface SvgProps extends SVGProps<SVGSVGElement> {
  contents: string
  classes?: string
  theme: string
}

interface SvgIconProps extends SVGProps<SVGSVGElement> {
  viewBoxWidth?: string
  viewBoxHeight?: string
  theme: string
  name: string
  classes?: string
}

export function Svg({ theme, contents, ...props }: SvgProps): JSX.Element {
  const [svgProps, svgContents] = parseSVG(readFileSync(resolveImagePath(theme, '', contents), 'utf8'))

  return <svg {...normalizeSVGProps(svgProps)} {...props} dangerouslySetInnerHTML={{ __html: svgContents }} />
}

export function SvgIcon(props: SvgIconProps): JSX.Element {
  const { viewBoxWidth: rawViewBoxWidth, viewBoxHeight: rawViewBoxHeight, theme, name } = props

  const rawContents = readFileSync(resolveImagePath(theme, '', `@theme/icons/${name}.svg`), 'utf8')

  const viewBoxWidth = rawViewBoxWidth ?? 24
  const viewBoxHeight = rawViewBoxHeight ?? 24

  const [svgProps, svgContents] = parseSVG(rawContents)

  return (
    <svg
      {...normalizeSVGProps(svgProps)}
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      {...props}
      dangerouslySetInnerHTML={{ __html: svgContents }}
    />
  )
}

export function SvgCloseIcon(): JSX.Element {
  return (
    <svg
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
