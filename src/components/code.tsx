import { type VNode } from 'preact'
import { type Slide } from '../slidesets/models.js'
import { useFreya } from './context.js'

export function Code({ rendered, className }: Slide['code'] & { className?: string }): VNode | null {
  const { resolveClasses } = useFreya()

  if (!rendered) {
    return null
  }

  return (
    <div
      className={resolveClasses('freya@code', className)}
      dangerouslySetInnerHTML={{ __html: rendered.replaceAll('$', '&#36;') }}
    />
  )
}
