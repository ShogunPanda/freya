import { type BuildContext } from 'dante'
import QRCodeGenerator from 'qrcode-generator'
import { useContext } from 'react'
import { getAlignments, getCover, isAlignment, isCovered, isFinder } from '../rendering/qr.js'
import { CSSClassesResolverContext } from './classes-resolver.js'
import { Image } from './image.js'

type QRCodeGeneratorInterface = typeof QRCodeGenerator

interface QRCodeProps {
  context: BuildContext
  data: string
  label?: string
  image?: string
  imageRatio?: number
  classes?: {
    code?: string
    qr?: string
    image?: string
    label?: string
  }
}

const padding = 1
const radius = 5
const diameter = radius * 2 // This is also the stroke width - Consider that all the strokes consider the origin its middle point
const unit = diameter + padding * 2 // This is the grid unit
const rectCornerSize = diameter + radius // Because you specify the diameter in the paths and then have to consider half the stroke width, which is the radius

/*
  Draw the corners and aligments.

  For all this consider the stroke is radius * 2 to align with dots, and that the stroke is
  drawn half inside and half outside the border (and the boundaries).
*/
function drawFinder(x: number, y: number, size: number = 7, innerSizeModifier: number = 4): string {
  const outerTotalSize = size * unit - padding * 2
  const outerSideSize = outerTotalSize - rectCornerSize * 2
  const outerPositionX = unit * x + padding + radius + diameter // Move right to exclude the top-left corner
  const outerPositionY = unit * y + padding + radius

  const innerTotalSize = (size - innerSizeModifier) * unit + diameter - padding * 2 // Add the diameter manually as stroke is not used here
  const innerSideSize = innerTotalSize - rectCornerSize * 2
  const innerPositionX = unit * (x + innerSizeModifier / 2) + padding + diameter // Move right to exclude the top-left corner
  const innerPositionY = unit * (y + innerSizeModifier / 2) + padding

  const outer = [
    `M${outerPositionX},${outerPositionY}`, // Move to the origin of the outer rectangle
    `h${outerSideSize}`, // Draw the top line
    `s${diameter},0,${diameter},${diameter}`, // Draw the top right border -> Parameters are the control point and the ending point
    `v${outerSideSize}`, // Draw the right line
    `s0,${diameter},-${diameter},${diameter}`, // Draw the top right border
    `h-${outerSideSize}`, // Draw the bottom line
    `s-${diameter},0,${-diameter},${-diameter}`, // Draw the top right border
    `v-${outerSideSize}`, // Draw the top line
    `s0,-${diameter},${diameter},-${diameter}`, // Draw the top left border
    ''
  ]

  const inner = [
    `M${innerPositionX},${innerPositionY}`, // Move to the origin of the inner rectangle
    `h${innerSideSize}`, // Draw the top line
    `s${diameter},0,${diameter},${diameter}`, // Draw the top right border -> Parameters are the control point and the ending point
    `v${innerSideSize}`, // Draw the right line
    `s0,${diameter},-${diameter},${diameter}`, // Draw the top right border
    `h-${innerSideSize}`, // Draw the bottom line
    `s-${diameter},0,${-diameter},${-diameter}`, // Draw the top right border
    `v-${innerSideSize}`, // Draw the top line
    `s0,-${diameter},${diameter},-${diameter}`, // Draw the top left border
    ''
  ]

  return `
    <path d="${outer.join(' ')}" fill="none" stroke="currentColor" stroke-width=${diameter} />
    <path d="${inner.join(' ')}" fill="currentColor" stroke="none" />
  `
}

function drawAlignment(x: number, y: number, size: number = 5): string {
  const outerTotalSize = size * unit - padding * 2
  const outerSideSize = outerTotalSize - rectCornerSize * 2
  const outerPositionX = unit * x + padding + radius + diameter // Move right to exclude the top-left corner
  const outerPositionY = unit * y + padding + radius

  const circlePositionX = unit * (x + 2) + padding
  const circlePositionY = unit * (y + 2) + padding + radius

  // const circlePosition =
  const outer = [
    `M${outerPositionX},${outerPositionY}`, // Move to the origin of the outer rectangle
    `h${outerSideSize}`, // Draw the top line
    `s${diameter},0,${diameter},${diameter}`, // Draw the top right border -> Parameters are the control point and the ending point
    `v${outerSideSize}`, // Draw the right line
    `s0,${diameter},-${diameter},${diameter}`, // Draw the top right border
    `h-${outerSideSize}`, // Draw the bottom line
    `s-${diameter},0,${-diameter},${-diameter}`, // Draw the top right border
    `v-${outerSideSize}`, // Draw the top line
    `s0,-${diameter},${diameter},-${diameter}`, // Draw the top left border
    ''
  ]

  const circle = [
    `M${circlePositionX},${circlePositionY}`, // Move to the origin of the inner rectangle
    `a${radius},${radius},0,1,0,${diameter},0 a${radius},${radius},0,1,0,${-diameter},0` // Draw the circle
  ]

  return `
    <path d="${outer.join(' ')}" fill="none" stroke="currentColor" stroke-width=${diameter} />
    <path d="${circle.join(' ')}" fill="currentColor" stroke="none" />
  `
}

function drawCircle(x: number, y: number): string {
  const positionX = padding + x * unit
  const positionY = padding + y * unit + radius

  return `M${positionX},${positionY} a${radius},${radius},0,1,0,${diameter},0 a${radius},${radius},0,1,0,${-diameter},0 `
}

export function generateQR(
  data: string,
  type: Parameters<QRCodeGeneratorInterface>[0] = 0,
  errorCorrection: 'L' | 'M' | 'Q' | 'H' = 'H'
): ReturnType<QRCodeGeneratorInterface> {
  const qr = QRCodeGenerator(type, errorCorrection)
  qr.addData(data)
  qr.make()

  return qr
}

export function QRCode({ context, data, image, imageRatio, label, classes }: QRCodeProps): JSX.Element {
  const resolveClasses = useContext(CSSClassesResolverContext)

  const { code: codeClassName, qr: qrClassName, label: labelClassName, image: imageClassName } = classes ?? {}

  // Generate the QR Code
  const qr = generateQR(data)

  // Get some QR parameters
  const moduleCount = qr.getModuleCount()
  const dimension = moduleCount * unit + padding
  const aligments = getAlignments(moduleCount)

  // Mask the image, if asked to
  const covered = image && imageRatio ? getCover(moduleCount, imageRatio) : []

  // Get values of all modules in a single array, excluding finder and aligments
  const modules = Array.from({ length: moduleCount }, (_, y) => {
    return Array.from({ length: moduleCount }, (_, x) => {
      if (isFinder(moduleCount, y, x) || isAlignment(aligments, y, x) || isCovered(covered, y, x)) {
        return 0
      }

      return Number(qr.isDark(y, x))
    })
  }).flat()

  let svgPath = ''
  let svgPoints = ''
  // Draw the modules
  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === 0) {
      continue
    }

    const y = Math.floor(i / moduleCount)
    const x = i % moduleCount

    svgPoints += drawCircle(x, y)
  }
  svgPath += `<path d="${svgPoints}" fill="currentColor" stroke="none" />`

  // Draw the finders
  svgPath += drawFinder(0, 0)
  svgPath += drawFinder(moduleCount - 7, 0)
  svgPath += drawFinder(0, moduleCount - 7)

  // Draw the aligments
  for (const aligment of aligments) {
    svgPath += drawAlignment(aligment[0], aligment[1])
  }

  return (
    <div className={resolveClasses('freya@qr', codeClassName)}>
      <div className={resolveClasses('freya@qr__wrapper')}>
        <svg
          data-url={data}
          className={resolveClasses('freya@qr__code', qrClassName)}
          dangerouslySetInnerHTML={{ __html: svgPath }}
          width={dimension}
          height={dimension}
          viewBox={`0 0 ${dimension} ${dimension}`}
        ></svg>

        {image && (
          <div className={resolveClasses('freya@qr__image-wrapper')}>
            <Image context={context} src={image} className={resolveClasses('freya@qr__image', imageClassName)} />
          </div>
        )}
      </div>
      {label && (
        <a href={data} target="_blank" rel="noopener noreferrer" className={resolveClasses(labelClassName)}>
          {label}
        </a>
      )}
    </div>
  )
}
