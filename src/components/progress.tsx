import { type VNode } from 'preact'
import { useClient, useSlide } from './contexts.tsx'
import { cleanCssClasses } from './styling.ts'

interface ProgressProps {
  // eslint-disable-next-line react/no-unused-prop-types
  current: number
  className?: string
}

export function Progress({ className }: ProgressProps): VNode {
  const {
    talk: { slidesCount }
  } = useClient()
  const { index } = useSlide()

  return (
    <div
      className={cleanCssClasses('freya@progress', className)}
      style={{ '--freya-slide-progress': ((index / slidesCount) * 100).toFixed(2) }}
    />
  )
}
