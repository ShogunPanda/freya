import { createContext, type FunctionComponent, type VNode } from 'preact'
import { useContext, useEffect } from 'preact/hooks'
import { type Slide as SlideModel, type SlideProps } from '../slidesets/models.js'
import { useClient, useSlide } from './contexts.js'

export const LayoutContext = createContext<Record<string, FunctionComponent<SlideProps>>>({})

export function SlideComponent({ className }: SlideProps): VNode {
  const layouts = useContext(LayoutContext)
  const { slide, index } = useSlide<SlideModel>()

  const {
    resolveClasses,
    talk: { slidesCount }
  } = useClient()

  const Layout = layouts[slide.layout ?? 'default']

  useEffect(() => {
    document.body.style.setProperty('--freya-slide-progress', `${((index / slidesCount) * 100).toFixed(2)}`)
  }, [])

  return <Layout className={resolveClasses(className)} />
}
