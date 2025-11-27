import type { FunctionComponent, VNode } from 'preact'
import type { Slide as SlideModel, SlideProps } from '../slidesets/models.ts'
import { createContext } from 'preact'
import { useContext } from 'preact/hooks'
import { useClient, useSlide } from './contexts.tsx'
import { cleanCssClasses } from './styling.ts'

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
