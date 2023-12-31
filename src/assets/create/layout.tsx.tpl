import { type Slide, type SlideProps, useFreya, Progress } from '@perseveranza-pets/freya'
import { type VNode } from 'preact'

export function DefaultLayout({ slide, index, className }: SlideProps<Slide>): VNode {
  const { resolveClasses } = useFreya()
  const { title, content } = slide

  return (
    <article className={resolveClasses('freya@slide', className)}>
      <h1>{title}</h1>
      <p>{content}</p>    
      <Progress current={index} />
    </article>
  )
}