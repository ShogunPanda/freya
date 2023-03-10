import QRCodeGenerator from 'qrcode-generator'
import { normalizeSVGProps, parseSVG } from '../generation/svg.js'

type QRCodeGeneratorInterface = typeof QRCodeGenerator

interface QRCodeProps {
  data: string
  className?: string
}

export function generateQR(
  data: string,
  type: Parameters<QRCodeGeneratorInterface>[0] = 0,
  errorCorrection: 'L' | 'M' | 'Q' | 'H' = 'M'
): ReturnType<QRCodeGeneratorInterface> {
  const qr = QRCodeGenerator(type, errorCorrection)
  qr.addData(data)
  qr.make()

  return qr
}

export function QRCode({ data, className }: QRCodeProps): JSX.Element {
  const qr = generateQR(data)

  const [svgProps, svgContents] = parseSVG(qr.createSvgTag({ scalable: true, margin: 1 }))

  return (
    <svg
      data-string={data}
      {...normalizeSVGProps(svgProps)}
      className={className}
      dangerouslySetInnerHTML={{ __html: svgContents }}
    />
  )
}
