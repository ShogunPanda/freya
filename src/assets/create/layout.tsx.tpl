import type { Slide, SlideProps } from '@perseveranza-pets/freya/client'
import type { VNode } from 'preact'
import { cleanCssClasses, useSlide } from '@perseveranza-pets/freya/client'
import { Text } from '../../common/components/common.tsx'
import { SlideWrapper } from '../components/common.tsx'

export default function DefaultLayout({ className, style }: SlideProps): VNode {
  const {
    slide: { title, content }
  } = useSlide<Slide>()

  return (
    <SlideWrapper className={cleanCssClasses('theme@default', className)} style={style}>
      <h1><Text text={title} /></h1>
      {(content ?? []).map((paragraph: string, index: number) => (
        <p key={index}><Text text={paragraph} /></p>
      ))}
    </SlideWrapper>
  )
}
