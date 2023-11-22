import { type Slide } from '../slidesets/models.js'

export function Code({
  context,
  rendered,
  className
}: Slide['code'] & Slide['context'] & { className?: string }): JSX.Element | null {
  if (!rendered) {
    return null
  }

  return (
    <div
      className={context.extensions.expandClasses(`freya@code ${className ?? ''}`.trim())}
      dangerouslySetInnerHTML={{ __html: rendered.replaceAll('$', '&#36;') }}
    />
  )
}
