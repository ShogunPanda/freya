import { type VNode } from 'preact'
import { useFreya } from './context.js'

interface ImageProps {
  src: string
  className?: string
}

export function Image({ src, className }: ImageProps): VNode {
  const { resolveClasses } = useFreya()
  return <img className={resolveClasses('freya@image', className)} src={src} />
}
