import { Image, resolveImageUrl } from '../../../../../dist/index.js'
import { type SlideProps } from '../../../../../src/index.js'
import { SlideWrapper, Text } from '../components/common.js'
import { type Slide } from '../models.js'

export default function DefaultLayout(props: SlideProps<Slide>): JSX.Element {
  const { context, theme, talk, index, slide } = props
  const resolveClasses = context.extensions.freya.resolveClasses

  const {
    title,
    image,
    classes: { slide: className, title: titleClassName, image: imageClassName }
  } = slide

  const imageUrl = resolveImageUrl('main', talk.id, image)

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

      <Image context={context} src={imageUrl} className={resolveClasses('theme@image', imageClassName)} />
    </SlideWrapper>
  )
}
