import { type VNode } from 'preact'
import { useClient, useSlide } from './contexts.js'

interface ProgressProps {
  current: number
  className?: string
}

export function Progress({ className }: ProgressProps): VNode {
  const {
    talk: { slidesCount },
    resolveClasses
  } = useClient()
  const { index } = useSlide()

  return (
    <div
      className={resolveClasses('freya@progress', className)}
      style={{ '--freya-slide-progress': ((index / slidesCount) * 100).toFixed(2) }}
    />
  )
}
