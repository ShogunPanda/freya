import type { Context, VNode } from 'preact'
import type { Slide } from '../slidesets/models.ts'
import type { SlideContextProps } from './contexts.tsx'
import { route } from 'preact-router'
// eslint-disable-next-line import/order
import { useCallback, useLayoutEffect, useRef } from 'preact/hooks'
import { shouldAbortSlideChange, slideUrl } from './client.ts'
import { SlideContextInstance, useClient, useSlide } from './contexts.tsx'
import { SlideComponent } from './slide.tsx'
import { cleanCssClasses } from './styling.ts'
import { SvgIcon } from './svg.tsx'

interface OverlayProps {
  className?: string
}

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

export function Overlay({ className }: OverlayProps): VNode {
  return <div className={cleanCssClasses('freya@overlay', className)} />
}

export function Navigator({ className, close }: NavigatorProps): VNode {
  const {
    id,
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
  }, [root, dimensions])

  const goto = useCallback(
    (index: number) => {
      if (shouldAbortSlideChange(id, index + 1)) {
        return
      }

      route(slideUrl(id, index + 1, slidesPadding))
      close()
    },
    [close, id, slidesPadding]
  )

  return (
    <nav ref={root} className={cleanCssClasses('freya@navigator', className)}>
      <a href="#" className={cleanCssClasses('freya@navigator__close')} onClick={close}>
        <SvgIcon name="close" className={cleanCssClasses('freya@svg-icon', 'freya@navigator__close__image')} />
      </a>

      {slides.map((slide, index) => (
        <div
          key={index}
          className={cleanCssClasses(
            'freya@navigator__slide',
            index + 1 === current && 'freya@navigator__slide--active'
          )}
          // eslint-disable-next-line react/jsx-no-bind
          onClick={goto.bind(null, index)}
        >
          <SlideContextWithModel.Provider value={{ slide, index, previousIndex: index, navigator: true }}>
            <SlideComponent className={cleanCssClasses('freya@navigator__slide__contents')} overrideProgress={true} />
          </SlideContextWithModel.Provider>

          <span className={cleanCssClasses('freya@navigator__slide__number')}>{index + 1}</span>
        </div>
      ))}
    </nav>
  )
}
