import { ComponentChildren, type JSX, type VNode } from 'preact'
import { useFreya } from '../../../../../dist/components/context.js'
import { Progress } from '../../../../../dist/components/progress.js'
import { type Slide } from '../models.js'

interface SlideWrapperProps {
  slide: Slide
  index: number
  className?: string
  style?: JSX.CSSProperties
  children: ComponentChildren | ComponentChildren[]
}

interface TextProps {
  text: string
  className?: string
}

export function Text({ text, className }: TextProps): VNode {
  const { resolveClasses, parseContent } = useFreya()

  text = parseContent(text).replaceAll(
    / class="([^"]+)"/g,
    (_: string, classes: string) => ` class="${resolveClasses(classes)}"`
  )

  return (
    <span className={className ? resolveClasses(className) : undefined} dangerouslySetInnerHTML={{ __html: text }} />
  )
}

export function SlideWrapper({ slide, index, style, className, children }: SlideWrapperProps): VNode {
  const { resolveClasses } = useFreya()

  const { foreground, background } = slide

  // These two should be moved to the SlideWrapper component
  const foregroundClass = foreground ? `theme@text-${foreground}` : ''
  const backgroundClass = background ? `theme@bg-${background}` : ''

  return (
    <article className={resolveClasses('freya@slide', foregroundClass, backgroundClass, className)} style={style}>
      {children}
      <Progress current={index} />
    </article>
  )
}
