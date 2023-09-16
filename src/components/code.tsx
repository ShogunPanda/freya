import { Slide } from '../generation/models.js'

export function Code({ rendered, className }: Required<Slide>['code'] & { className?: string }): JSX.Element | null {
  if (!rendered) {
    return null
  }

  return (
    <div
      className={`code ${className ?? ''}`.trim()}
      dangerouslySetInnerHTML={{ __html: rendered.replaceAll('$', '&#36;') }}
    />
  )
}
