import { type ComponentType, type VNode } from 'preact'
import { FreyaContextRoot, type FreyaContextProps } from '../components/context.js'
import { type SlideProps } from '../slidesets/models.js'

type SlideComponentProps = SlideProps & FreyaContextProps & { layout: ComponentType<SlideProps> }

export function SlideComponent(props: SlideComponentProps): VNode {
  const { context, layout: Layout, parseContent, resolveImage, resolveClasses, resolveSVG } = props
  const freyaProps = { context, resolveClasses, resolveImage, resolveSVG, parseContent }

  return (
    <FreyaContextRoot {...freyaProps}>
      <Layout {...props} />
    </FreyaContextRoot>
  )
}
