import { type SlideProps } from '../../../../../src/index.js'
import { SlideWrapper, Text } from '../components/common.js'
import { type Slide } from '../models.js'

export default function DefaultLayout(props: SlideProps<Slide>): JSX.Element {
  const { context, theme, talk, index, slide } = props
  const resolveClasses = context.extensions.freya.resolveClasses

  const {
    title,
    subtitle,
    content,
    classes: { slide: className, title: titleClassName, subtitle: subtitleClassName, content: contentClassName }
  } = slide

  return (
    <SlideWrapper
      context={context}
      theme={theme}
      talk={talk}
      slide={slide}
      index={index}
      className={resolveClasses(className)}
    >
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

      {content?.filter(Boolean).map((c: string | object, contentIndex: number) => {
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
