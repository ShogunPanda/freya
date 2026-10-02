import type { SlideProps } from '@perseveranza-pets/freya/client'
import type { ComponentChildren, VNode } from 'preact'
import { cleanCssClasses, Progress, useClient, useSlide } from '@perseveranza-pets/freya/client'

interface SlideWrapperProps extends SlideProps {
  children: ComponentChildren
}

export function SlideWrapper({ className, style, children }: SlideWrapperProps): VNode {
  const { isExporting } = useClient()
  const { index } = useSlide()

  return (
    <article className={cleanCssClasses('freya@slide', className)} style={style} data-pptx="group">
      {children}
      {!isExporting && <Progress current={index} />}
    </article>
  )
}
