import { type VNode } from 'preact'
import { useFreya } from './context.js'

interface ProgressProps {
  current: number
  className?: string
}

export function Progress({ current, className }: ProgressProps): VNode {
  const {
    talk: { slidesCount },
    resolveClasses
  } = useFreya()

  return (
    <div
      className={resolveClasses('freya@progress', className)}
      style={{ '--freya-slide-progress': ((current / slidesCount) * 100).toFixed(2) }}
    />
  )
}
