import { createContext, type FunctionComponent, type VNode } from 'preact'
import { useContext, useEffect } from 'preact/hooks'
import { type RoutableProps } from 'preact-router'
import { type Slide as SlideModel } from '../slidesets/models.js'
import { useFreya } from './context.js'

interface SlideProps {
  slide: SlideModel
  index: number
  className?: string
}

export const LayoutContext = createContext<Record<string, FunctionComponent<SlideProps>>>({})

export function Slide({ slide, index, className }: SlideProps): VNode {
  const layouts = useContext(LayoutContext)
  const {
    resolveClasses,
    talk: { slidesCount }
  } = useFreya()

  const Layout = layouts[slide.layout ?? 'default']

  useEffect(() => {
    document.body.style.setProperty('--freya-slide-progress', `${((index / slidesCount) * 100).toFixed(2)}`)
  }, [])

  return <Layout slide={slide} index={index} className={resolveClasses(className)} />
}

export function CurrentSlide({ index }: RoutableProps & { index: number }): VNode {
  const { talk } = useFreya()
  const slide = talk.slides[index - 1]

  if (!slide) {
    return <></>
  }

  return <Slide slide={slide} index={index} />
}
