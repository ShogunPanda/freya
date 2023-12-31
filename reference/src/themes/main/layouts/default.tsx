import { type VNode } from 'preact'
import { useFreya } from '../../../../../dist/components/context.js'
import { type SlideProps } from '../../../../../src/index.js'
import { SlideWrapper, Text } from '../components/common.js'
import { type Slide } from '../models.js'

export default function DefaultLayout(props: SlideProps<Slide>): VNode {
  const { resolveClasses } = useFreya()

  const { index, slide, className } = props

  const {
    title,
    subtitle,
    content,
    classes: { slide: slideClassName, title: titleClassName, subtitle: subtitleClassName, content: contentClassName }
  } = slide

  return (
    <SlideWrapper slide={slide} index={index} className={resolveClasses(className, slideClassName)}>
      {title && (
        <h1 className={resolveClasses('theme@title', titleClassName)}>
          <Text text={title} />
        </h1>
      )}

      {subtitle && (
        <h2 className={resolveClasses('theme@subtitle', subtitleClassName)}>
          <Text text={subtitle} />
        </h2>
      )}

      {content?.filter(Boolean).map((c: string, contentIndex: number) => {
        const key = `content:${index}:${contentIndex}`

        return (
          <h4 key={key} className={resolveClasses('theme@content', contentClassName)}>
            <Text text={c} />
          </h4>
        )
      })}
    </SlideWrapper>
  )
}
