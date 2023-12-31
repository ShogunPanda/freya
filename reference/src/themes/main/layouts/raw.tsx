import { type VNode } from 'preact'
import { useFreya } from '../../../../../dist/components/context.js'
import { type SlideProps } from '../../../../../src/index.js'
import { SlideWrapper, Text } from '../components/common.js'
import { type Slide } from '../models.js'

export default function RawLayout(props: SlideProps<Slide>): VNode {
  const { resolveClasses } = useFreya()

  const { index, slide, className } = props

  const {
    title,
    raw,
    classes: { slide: slideClassName, title: titleClassName, raw: rawClassName }
  } = slide

  return (
    <SlideWrapper slide={slide} index={index} className={resolveClasses(className, slideClassName)}>
      {title && (
        <h1 className={resolveClasses('theme@title', titleClassName)}>
          <Text text={title} />
        </h1>
      )}

      {raw && <Text text={raw} className={rawClassName} />}
    </SlideWrapper>
  )
}
