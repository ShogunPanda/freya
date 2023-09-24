import QRCodeGenerator from 'qrcode-generator'
import { getAlignments, getCover, isAlignment, isCovered, isFinder } from '../generation/qr.js'

type QRCodeGeneratorInterface = typeof QRCodeGenerator

interface QRCodeProps {
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
const diameter = radius * 2
const size = diameter + padding * 2

/*
  Draw the corners and aligments.

  For all this consider the stroke is radius * 2 to align with dots, and that the stroke is
  drawn half inside and half outside the border (and the boundaries).
*/
function drawFinder(x: number, y: number): string {
  const opx = size * x + padding + radius
  const opy = size * y + padding + radius
  const osize = size * 5 + padding * 2 + radius * 2
  const ipx = size * (x + 2) + padding
  const ipy = size * (y + 2) + padding
  const isize = size * 3 - padding * 2

  return `
    <rect x="${opx}" y="${opy}" width="${osize}" height="${osize}" stroke="currentColor" stroke-width="${diameter}" fill="none" rx="${diameter}" ry="${diameter}"/>
     <rect x="${ipx}" y="${ipy}" width="${isize}" height="${isize}" stroke="none" fill="currentColor" fill="transparent" rx="${diameter}" ry="${diameter}"/>   
    `
}

function drawAlignment(x: number, y: number): string {
  const opx = size * x + padding + radius
  const opy = size * y + padding + radius
  const osize = size * 3 + padding * 2 + radius * 2
  const ipx = size * (x + 2) + padding + radius
  const ipy = size * (y + 2) + padding + radius

  return `
    <rect x="${opx}" y="${opy}" width="${osize}" height="${osize}" stroke="currentColor" stroke-width="${diameter}" fill="none" rx="${diameter}" ry="${diameter}"/>
    <circle cx="${ipx}" cy="${ipy}" r="${radius}" stroke="none" fill="currentColor"/>
  `
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

export function QRCode({ data, image, imageRatio, label, classes }: QRCodeProps): JSX.Element {
  const { code: codeClassName, qr: qrClassName, label: labelClassName, image: imageClassName } = classes ?? {}

  // Generate the QR Code
  const qr = generateQR(data)

  // Get some QR parameters
  const moduleCount = qr.getModuleCount()
  const dimension = moduleCount * size + padding
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

  let svgContents = ''

  // Draw the modules
  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === 0) {
      continue
    }

    const y = Math.floor(i / moduleCount)
    const x = i % moduleCount

    const cx = padding + x * size + radius
    const cy = padding + y * size + radius
    svgContents += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="currentColor" stroke="none" />`
  }

  // Draw the finders
  svgContents += drawFinder(0, 0)
  svgContents += drawFinder(moduleCount - 7, 0)
  svgContents += drawFinder(0, moduleCount - 7)

  // Draw the aligments
  for (const aligment of aligments) {
    svgContents += drawAlignment(aligment[0], aligment[1])
  }

  return (
    <div className={`qr ${codeClassName ?? ''}`.trim()}>
      <div className="relative">
        <svg
          data-url={data}
          className={`w-full h-auto ${qrClassName ?? ''}`.trim()}
          dangerouslySetInnerHTML={{ __html: svgContents }}
          width={dimension}
          height={dimension}
          viewBox={`0 0 ${dimension} ${dimension}`}
        />

        {image && (
          <div className="absolute w-full h-full top-0 left-0 flex items-center justify-center">
            <img src={image} className={imageClassName ?? ''} />
          </div>
        )}
      </div>
      {label && (
        <a href={data} target="_blank" rel="noopener noreferrer" className={labelClassName}>
          {label}
        </a>
      )}
    </div>
  )
}
