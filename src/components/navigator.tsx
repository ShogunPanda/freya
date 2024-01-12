import { type VNode } from 'preact'
import { useCallback, useLayoutEffect, useRef } from 'preact/hooks'
import { route } from 'preact-router'
import { type Slide } from '../slidesets/models.js'
import { shouldAbortSlideChange, slideUrl } from './client.js'
import { useFreya, type CSSClassToken } from './context.js'
import { Slide as SlideComponent } from './slide.js'
import { SvgCloseIcon } from './svg.js'

interface NavigatorProps {
  current: number
  slides: Slide[]
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

export function Navigator({ current, slides, className, close }: NavigatorProps): VNode {
  const {
    id,
    resolveClasses,
    dimensions,
    talk: { slidesPadding }
  } = useFreya()
  const root = useRef<HTMLElement>(null)

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
        <SvgCloseIcon className={resolveClasses('freya@navigator__close__image')} />
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
          <SlideComponent slide={slide} index={index} className={resolveClasses('freya@navigator__slide__contents')} />
          <span className={resolveClasses('freya@navigator__slide__number')}>{index + 1}</span>
        </div>
      ))}
    </nav>
  )
}
