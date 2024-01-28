import { type ComponentType, type VNode } from 'preact'
import {
  ClientContextInstance,
  SlideContextInstance,
  createClientContextValue,
  type ClientContextMethods
} from '../components/contexts.js'
import { type ClientContext as ClientContextModel, type Slide, type SlideProps } from '../slidesets/models.js'

interface SlideComponentProps {
  context: ClientContextModel
  layout: ComponentType<SlideProps>
  slide: Slide
  index: number
}

export function SlideComponent(props: SlideProps & ClientContextMethods & SlideComponentProps): VNode {
  const { context, layout: Layout, slide, index, parseContent, resolveImage, resolveClasses, resolveSVG } = props

  return (
    <ClientContextInstance.Provider
      value={createClientContextValue(context, { resolveClasses, resolveImage, resolveSVG, parseContent })}
    >
      <SlideContextInstance.Provider value={{ slide, index, previousIndex: index }}>
        <Layout {...props} />
      </SlideContextInstance.Provider>
    </ClientContextInstance.Provider>
  )
}
