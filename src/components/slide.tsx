import { createContext, type FunctionComponent, type VNode } from 'preact'
import { useContext } from 'preact/hooks'
import { type Slide as SlideModel, type SlideProps } from '../slidesets/models.js'
import { useClient, useSlide } from './contexts.js'
import { cleanCssClasses } from './styling.js'

export const LayoutContext = createContext<Record<string, FunctionComponent<SlideProps>>>({})

export function SlideComponent({ overrideProgress, className }: SlideProps): VNode {
  const {
    talk: { slidesCount }
  } = useClient()
  const { slide, index } = useSlide<SlideModel>()
  const layouts = useContext(LayoutContext)

  const style: Record<string, string> = {}

  if (overrideProgress) {
    style['--freya-progress'] = ((index / slidesCount) * 100).toFixed(2)
  }

  const Layout = layouts[slide.layout ?? 'default']

  return <Layout className={cleanCssClasses(className)} style={style} />
}
