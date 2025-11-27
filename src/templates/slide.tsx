import type { ComponentType, VNode } from 'preact'
import type { ClientContextMethods } from '../components/contexts.tsx'
import type { ClientContext as ClientContextModel, Slide, SlideProps } from '../slidesets/models.ts'
import { Presenter, SvgDefinitions } from '../client.ts'
import { ClientContextInstance, SlideContextInstance, createClientContextValue } from '../components/contexts.tsx'
import { Controller } from '../components/controller.tsx'
import { Navigator, Overlay } from '../components/navigator.tsx'

interface SlideComponentProps {
  context: ClientContextModel
  // eslint-disable-next-line react/no-unused-prop-types
  layout: ComponentType<SlideProps>
  slide: Slide
  index: number
}

function noop(): void {}

export function SlideComponent(props: SlideProps & ClientContextMethods & SlideComponentProps): VNode {
  const { context, layout: Layout, slide, index, parseContent, resolveImage, resolveSVG } = props

  return (
    <ClientContextInstance.Provider
      value={createClientContextValue(context, { resolveImage, resolveSVG, parseContent })}
    >
      <SlideContextInstance.Provider value={{ slide, index, previousIndex: index }}>
        <Layout {...props} />
      </SlideContextInstance.Provider>
    </ClientContextInstance.Provider>
  )
}

export function Widgets(props: SlideProps & ClientContextMethods & SlideComponentProps): VNode {
  const { context, slide, index, parseContent, resolveImage, resolveSVG } = props

  return (
    <ClientContextInstance.Provider
      value={createClientContextValue(context, { resolveImage, resolveSVG, parseContent })}
    >
      <SlideContextInstance.Provider value={{ slide, index, previousIndex: index }}>
        <Overlay />
        <Navigator close={noop} />
        <Presenter close={noop} paused={false} duration={300} startPresentation={noop} togglePresentation={noop} />
        <Controller />
        <SvgDefinitions definitions={[]} />
      </SlideContextInstance.Provider>
    </ClientContextInstance.Provider>
  )
}
