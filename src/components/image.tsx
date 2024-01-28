import { type VNode } from 'preact'
import { useClient } from './contexts.js'

interface ImageProps {
  src: string
  className?: string
}

export function Image({ src, className }: ImageProps): VNode {
  const { resolveClasses } = useClient()
  return <img className={resolveClasses('freya@image', className)} src={src} />
}
