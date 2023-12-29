import { type BuildContext } from 'dante'
import { useContext } from 'react'
import { CSSClassesResolverContext } from './classes-resolver.js'

interface ImageProps {
  context: BuildContext
  src: string
  className?: string
}

export function Image({ context, src, className }: ImageProps): JSX.Element {
  const resolveClasses = useContext(CSSClassesResolverContext)

  context.extensions.freya.images.add(src)
  return <img className={resolveClasses('freya@image', className)} src={src} />
}
