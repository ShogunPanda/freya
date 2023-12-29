import { useContext } from 'react'
import { type Slide } from '../slidesets/models.js'
import { CSSClassesResolverContext } from './classes-resolver.js'

export function Code({ rendered, className }: Slide['code'] & { className?: string }): JSX.Element | null {
  const resolveClasses = useContext(CSSClassesResolverContext)

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
