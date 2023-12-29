import { type SlideProps } from '../../../../../src/index.js'
import { SlideWrapper, Text } from '../components/common.js'
import { type Slide } from '../models.js'

export default function DefaultLayout(props: SlideProps<Slide>): JSX.Element {
  const { context, theme, talk, index, slide } = props
  const resolveClasses = context.extensions.freya.resolveClasses

  const {
    title,
    raw,
    classes: { slide: className, title: titleClassName, raw: rawClassName }
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

      {raw && <Text text={raw} className={rawClassName} />}
    </SlideWrapper>
  )
}
