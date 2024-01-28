import { Progress, useClient, useSlide, type Slide, type SlideProps } from '@perseveranza-pets/freya'
import { type VNode } from 'preact'

export function DefaultLayout({ className }: SlideProps<Slide>): VNode {
  const { resolveClasses } = useClient()
  const {
    slide: { title, content },
    index
  } = useSlide()

  return (
    <article className={resolveClasses('freya@slide', className)}>
      <h1>{title}</h1>
      <p>{content}</p>
      <Progress />
    </article>
  )
}
