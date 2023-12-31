import { type VNode } from 'preact'
import { useLayoutEffect, useMemo, useRef } from 'preact/hooks'
import { type Slide } from '../slidesets/models.js'
import { useFreya, type CSSClassToken } from './context.js'
import { Slide as SlideComponent } from './slide.js'
import { SvgCloseIcon } from './svg.js'

interface PresenterProps {
  current: number
  slides: Slide[]
  close: () => void
  paused: boolean
  duration: number
  startPresentation: () => void
  togglePresentation: () => void
  showPrevious?: boolean
  className?: string
}

export const presenterCssClasses: CSSClassToken[] = [
  'freya@presenter',
  'freya@presenter--no-previous',
  'freya@presenter--with-previous',
  'freya@presenter__header',
  'freya@presenter__header__label',
  'freya@presenter__header__label--paused',
  'freya@presenter__header__action',
  'freya@presenter__slide',
  'freya@presenter__slide--previous',
  'freya@presenter__slide--current',
  'freya@presenter__slide--next',
  'freya@presenter__slide__contents',
  'freya@presenter__notes',
  'freya@presenter__close',
  'freya@presenter__close__image'
]

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
  current,
  slides,
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
    resolveClasses,
    parseContent,
    dimensions,
    talk: { slidesPadding, slidesCount }
  } = useFreya()

  const currentSlide = slides[current - 1]

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
  }, [current, previousElement, currentElement, nextElement])

  return (
    <section
      className={resolveClasses(
        'freya@presenter',
        `freya@presenter--${showPrevious ? 'with' : 'no'}-previous`,
        className
      )}
    >
      <header className={resolveClasses('freya@presenter__header')}>
        <span className={resolveClasses('freya@presenter__header__label')}>
          {current.toString().padStart(slidesPadding, '0')}/{slidesCount}
        </span>
        <a href="#" className={resolveClasses('freya@presenter__header__action')} onClick={togglePresentation}>
          &#x23EF;&#xFE0F;
        </a>
        <a href="#" className={resolveClasses('freya@presenter__header__action')} onClick={startPresentation}>
          &#x1F504;
        </a>
        <span
          className={resolveClasses(
            'freya@presenter__header__label',
            paused && 'freya@presenter__header__label--paused'
          )}
        >
          {time}
        </span>

        <a href="#" className={resolveClasses('freya@presenter__close')} onClick={close}>
          <SvgCloseIcon className={resolveClasses('freya@presenter__close__image')} />
        </a>
      </header>

      {showPrevious && current > 1 && (
        <aside
          ref={previousElement}
          className={resolveClasses('freya@presenter__slide', 'freya@presenter__slide--previous')}
        >
          <SlideComponent
            slide={slides[current - 2]}
            index={current - 1}
            className={resolveClasses('freya@presenter__slide__contents')}
          />
          <span className={resolveClasses('freya@presenter__slide__number')}>{current - 1}</span>
        </aside>
      )}

      <main
        ref={currentElement}
        className={resolveClasses('freya@presenter__slide', 'freya@presenter__slide--current')}
      >
        <SlideComponent
          slide={currentSlide}
          index={current}
          className={resolveClasses('freya@presenter__slide__contents')}
        />
        <span className={resolveClasses('freya@presenter__slide__number')}>{current}</span>
      </main>

      {current < slidesCount && (
        <aside ref={nextElement} className={resolveClasses('freya@presenter__slide', 'freya@presenter__slide--next')}>
          <SlideComponent
            slide={slides[current]}
            index={current + 1}
            className={resolveClasses('freya@presenter__slide__contents')}
          />
          <span className={resolveClasses('freya@presenter__slide__number')}>{current + 1}</span>
        </aside>
      )}

      {currentSlide.notes && (
        <footer
          className={resolveClasses('freya@presenter__notes')}
          dangerouslySetInnerHTML={{ __html: parseContent(currentSlide.notes) }}
        />
      )}
    </section>
  )
}
