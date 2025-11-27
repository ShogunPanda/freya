import type { Context, VNode } from 'preact'
import type { Slide } from '../slidesets/models.ts'
import type { SlideContextProps } from './contexts.tsx'
import { useLayoutEffect, useMemo, useRef } from 'preact/hooks'
import { SlideContextInstance, useClient, useSlide } from './contexts.tsx'
import { SlideComponent } from './slide.tsx'
import { cleanCssClasses } from './styling.ts'
import { SvgIcon } from './svg.tsx'

interface PresenterProps {
  close: () => void
  paused: boolean
  duration: number
  startPresentation: () => void
  togglePresentation: () => void
  showPrevious?: boolean
  className?: string
}

function updatePresenterAppearance(elements: HTMLElement[], slideWidth: number, slideHeight: number): void {
  for (const element of elements) {
    const {
      width,
      borderLeftWidth: borderLeft,
      borderRightWidth: borderRight,
      borderTopWidth: borderTop,
      borderBottomWidth: borderBottom
    } = window.getComputedStyle(element)

    const innerWidth = parseFloat(width) - parseFloat(borderLeft) - parseFloat(borderRight)
    const scale = (innerWidth / slideWidth).toFixed(5)
    const navigatorSlideHeight = slideHeight * parseFloat(scale) + parseFloat(borderTop) + parseFloat(borderBottom)

    element.style.setProperty('--freya-slide-transform', `scale(${scale})`)
    element.style.setProperty('--freya-presenter-slide-height', `${navigatorSlideHeight}px`)
  }
}

export function Presenter({
  paused,
  duration,
  startPresentation,
  togglePresentation,
  showPrevious,
  className,
  close
}: PresenterProps): VNode {
  const previousElement = useRef<HTMLElement>(null)
  const currentElement = useRef<HTMLElement>(null)
  const nextElement = useRef<HTMLElement>(null)

  const {
    parseContent,
    dimensions,
    talk: { slides, slidesPadding, slidesCount }
  } = useClient()
  const { slide, index, previousIndex } = useSlide()

  const SlideContextWithModel = SlideContextInstance as unknown as Context<SlideContextProps<Slide>>

  const currentSlide = slides[index - 1]

  const time = useMemo(() => {
    const hour = Math.floor(duration / 60)
      .toString()
      .padStart(2, '0')
    const minute = (duration % 60).toString().padStart(2, '0')

    return `${hour}:${minute}`
  }, [duration])

  // Update slides appearance
  useLayoutEffect(() => {
    if (!currentElement.current) {
      return
    }

    const elements: HTMLElement[] = [previousElement, currentElement, nextElement].map(e => e.current!).filter(Boolean)

    const boundUpdatePresenterAppearance = updatePresenterAppearance.bind(
      null,
      elements,
      dimensions.width,
      dimensions.height
    )

    window.addEventListener('resize', boundUpdatePresenterAppearance, false)
    document.addEventListener('fullscreenchange', boundUpdatePresenterAppearance, false)
    updatePresenterAppearance(elements, dimensions.width, dimensions.height)

    return () => {
      window.removeEventListener('resize', boundUpdatePresenterAppearance, false)
      document.removeEventListener('fullscreenchange', boundUpdatePresenterAppearance, false)
    }
  }, [index, previousElement, currentElement, nextElement, dimensions])

  return (
    <section
      className={cleanCssClasses(
        'freya@presenter',
        `freya@presenter--${showPrevious ? 'with' : 'no'}-previous`,
        className
      )}
    >
      <header className={cleanCssClasses('freya@presenter__header')}>
        <span className={cleanCssClasses('freya@presenter__header__label')}>
          {index.toString().padStart(slidesPadding, '0')}/{slidesCount}
        </span>
        <a href="#" className={cleanCssClasses('freya@presenter__header__action')} onClick={togglePresentation}>
          <SvgIcon
            name="play"
            className={cleanCssClasses(
              'freya@svg-icon',
              'freya@presenter__header__action__icon',
              !paused && 'freya@presenter__header__action__icon--active'
            )}
          />
        </a>
        <a href="#" className={cleanCssClasses('freya@presenter__header__action')} onClick={startPresentation}>
          <SvgIcon
            name="reset"
            className={cleanCssClasses('freya@svg-icon', 'freya@presenter__header__action__icon')}
          />
        </a>
        <span
          className={cleanCssClasses(
            'freya@presenter__header__label',
            paused && 'freya@presenter__header__label--paused'
          )}
        >
          {time}
        </span>

        <a href="#" className={cleanCssClasses('freya@presenter__close')} onClick={close}>
          <SvgIcon name="close" className={cleanCssClasses('freya@svg-icon', 'freya@presenter__close__image')} />
        </a>
      </header>

      {showPrevious && index > 1 && (
        <aside
          ref={previousElement}
          className={cleanCssClasses('freya@presenter__slide', 'freya@presenter__slide--previous')}
        >
          <SlideContextWithModel.Provider
            value={{ slide: slides[index - 2], index: index - 1, previousIndex: index, presenter: true }}
          >
            <SlideComponent className={cleanCssClasses('freya@presenter__slide__contents')} overrideProgress={true} />
          </SlideContextWithModel.Provider>
          <span className={cleanCssClasses('freya@presenter__slide__number')}>{index - 1}</span>
        </aside>
      )}

      <main
        ref={currentElement}
        className={cleanCssClasses('freya@presenter__slide', 'freya@presenter__slide--current')}
      >
        <SlideContextWithModel.Provider value={{ slide: slide as Slide, index, previousIndex }}>
          <SlideComponent className={cleanCssClasses('freya@presenter__slide__contents')} overrideProgress={true} />
        </SlideContextWithModel.Provider>
        <span className={cleanCssClasses('freya@presenter__slide__number')}>{index}</span>
      </main>

      {index < slidesCount && (
        <aside ref={nextElement} className={cleanCssClasses('freya@presenter__slide', 'freya@presenter__slide--next')}>
          <SlideContextWithModel.Provider
            value={{ slide: slides[index], index: index + 1, previousIndex: index, presenter: true }}
          >
            <SlideComponent className={cleanCssClasses('freya@presenter__slide__contents')} overrideProgress={true} />
          </SlideContextWithModel.Provider>
          <span className={cleanCssClasses('freya@presenter__slide__number')}>{index + 1}</span>
        </aside>
      )}

      {currentSlide.notes && (
        <footer
          className={cleanCssClasses('freya@presenter__notes')}
          dangerouslySetInnerHTML={{ __html: parseContent(currentSlide.notes) }}
        />
      )}
    </section>
  )
}
