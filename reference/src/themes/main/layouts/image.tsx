import { type VNode } from 'preact'
import { useFreya } from '../../../../../dist/components/context.js'
import { Image } from '../../../../../dist/components/image.js'
import { type SlideProps } from '../../../../../src/index.js'
import { SlideWrapper, Text } from '../components/common.js'
import { type Slide } from '../models.js'

export default function ImageLayout(props: SlideProps<Slide>): VNode {
  const { talk, resolveClasses, resolveImage } = useFreya()

  const { index, slide, className } = props
  const {
    title,
    image,
    classes: { slide: slideClassName, title: titleClassName, image: imageClassName }
  } = slide

  const imageUrl = resolveImage('main', talk.id, image)

  return (
    <SlideWrapper slide={slide} index={index} className={resolveClasses(className, slideClassName)}>
      {title && (
        <h1 className={resolveClasses('theme@title', titleClassName)}>
          <Text text={title} />
        </h1>
      )}

      <Image src={imageUrl} className={resolveClasses('theme@image', imageClassName)} />
    </SlideWrapper>
  )
}
