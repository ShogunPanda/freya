import { type ComponentType, type VNode } from 'preact'
import { Presenter } from '../client.js'
import {
  ClientContextInstance,
  SlideContextInstance,
  createClientContextValue,
  type ClientContextMethods
} from '../components/contexts.js'
import { Controller } from '../components/controller.js'
import { Navigator, Overlay } from '../components/navigator.js'
import { type ClientContext as ClientContextModel, type Slide, type SlideProps } from '../slidesets/models.js'

interface SlideComponentProps {
  context: ClientContextModel
  layout: ComponentType<SlideProps>
  slide: Slide
  index: number
}

function noop(): void {}

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

export function Widgets(props: SlideProps & ClientContextMethods & SlideComponentProps): VNode {
  const { context, slide, index, parseContent, resolveImage, resolveClasses, resolveSVG } = props

  return (
    <ClientContextInstance.Provider
      value={createClientContextValue(context, { resolveClasses, resolveImage, resolveSVG, parseContent })}
    >
      <SlideContextInstance.Provider value={{ slide, index, previousIndex: index }}>
        <Overlay />
        <Navigator close={noop} />
        <Presenter close={noop} paused={false} duration={300} startPresentation={noop} togglePresentation={noop} />
        <Controller />
      </SlideContextInstance.Provider>
    </ClientContextInstance.Provider>
  )
}
