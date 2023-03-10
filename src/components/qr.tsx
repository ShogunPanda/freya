import QRCodeGenerator from 'qrcode-generator'
import { normalizeSVGProps, parseSVG } from '../generation/svg.js'

interface QRCodeProps {
  data: string
  className?: string
}

export function QRCode({ data, className }: QRCodeProps): JSX.Element {
  const qr = QRCodeGenerator(0, 'M')
  qr.addData(data)
  qr.make()

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
