import { type VNode } from 'preact'
import { cleanCssClasses } from './styling.ts'

interface ImageProps {
  src: string
  className?: string
}

export function Image({ src, className }: ImageProps): VNode {
  return <img className={cleanCssClasses('freya@image', className)} src={src} />
}
