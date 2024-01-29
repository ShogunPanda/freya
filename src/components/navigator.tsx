import { type Context, type VNode } from 'preact'
import { route } from 'preact-router'
import { useCallback, useLayoutEffect, useRef } from 'preact/hooks'
import { type Slide } from '../slidesets/models.js'
import { shouldAbortSlideChange, slideUrl } from './client.js'
import { SlideContextInstance, useClient, useSlide, type CSSClassToken, type SlideContextProps } from './contexts.js'
import { SlideComponent } from './slide.js'
import { SvgIcon } from './svg.js'

interface NavigatorProps {
  close: () => void
  className?: string
}

function updateNavigatorAppearance(root: HTMLElement, slideWidth: number, slideHeight: number): void {
  const slide = root.querySelector('div')!
  const {
    width,
    borderLeftWidth: borderLeft,
    borderRightWidth: borderRight,
    borderTopWidth: borderTop,
    borderBottomWidth: borderBottom
  } = window.getComputedStyle(slide)

  const innerWidth = parseFloat(width) - parseFloat(borderLeft) - parseFloat(borderRight)
  const scale = (innerWidth / slideWidth).toFixed(5)
  const navigatorSlideHeight = slideHeight * parseFloat(scale) + parseFloat(borderTop) + parseFloat(borderBottom)

  root.style.setProperty('--freya-slide-transform', `scale(${scale})`)
  root.style.setProperty('--freya-navigator-slide-height', `${navigatorSlideHeight}px`)
}

export const navigatorCssClasses: CSSClassToken[] = [
  'freya@navigator',
  'freya@navigator__slide',
  'freya@navigator__slide--active',
  'freya@navigator__slide__contents',
  'freya@navigator__slide__number',
  'freya@navigator__close',
  'freya@navigator__close__image'
]

export function Navigator({ className, close }: NavigatorProps): VNode {
  const {
    id,
    resolveClasses,
    dimensions,
    talk: { slides, slidesPadding }
  } = useClient()
  const { index: current } = useSlide()
  const root = useRef<HTMLElement>(null)
  const SlideContextWithModel = SlideContextInstance as unknown as Context<SlideContextProps<Slide>>

  useLayoutEffect(() => {
    if (!root.current) {
      return
    }

    const boundUpdateNavigatorAppearance = updateNavigatorAppearance.bind(
      null,
      root.current,
      dimensions.width,
      dimensions.height
    )

    window.addEventListener('resize', boundUpdateNavigatorAppearance, false)
    document.addEventListener('fullscreenchange', boundUpdateNavigatorAppearance, false)
    updateNavigatorAppearance(root.current, dimensions.width, dimensions.height)

    return () => {
      window.removeEventListener('resize', boundUpdateNavigatorAppearance, false)
      document.removeEventListener('fullscreenchange', boundUpdateNavigatorAppearance, false)
    }
  }, [root])

  const goto = useCallback(
    (index: number) => {
      if (shouldAbortSlideChange(id, index + 1)) {
        return
      }

      route(slideUrl(id, index + 1, slidesPadding))
      close()
    },
    [route, close]
  )

  return (
    <nav ref={root} className={resolveClasses('freya@navigator', className)}>
      <a href="#" className={resolveClasses('freya@navigator__close')} onClick={close}>
        <SvgIcon name="close" className={resolveClasses('freya@svg-icon', 'freya@navigator__close__image')} />
      </a>

      {slides.map((slide, index) => (
        <div
          key={index}
          className={resolveClasses(
            'freya@navigator__slide',
            index + 1 === current && 'freya@navigator__slide--active'
          )}
          onClick={goto.bind(null, index)}
        >
          <SlideContextWithModel.Provider value={{ slide, index, previousIndex: index, navigator: true }}>
            <SlideComponent className={resolveClasses('freya@navigator__slide__contents')} />
          </SlideContextWithModel.Provider>

          <span className={resolveClasses('freya@navigator__slide__number')}>{index + 1}</span>
        </div>
      ))}
    </nav>
  )
}
