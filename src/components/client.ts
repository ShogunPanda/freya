import { type CSSClassToken } from '@perseveranza-pets/dante'
import { route } from 'preact-router'
import { type Talk, type Theme } from '../slidesets/models.js'

type Shortcuts = Record<string, (...args: any[]) => void>

interface Touch {
  timestamp: number
  x: number
  y: number
}

export interface DOMContext {
  id: string
  talk: Talk
  theme: Theme
  index: number
  handleEscape: () => void
  toggleNavigator: () => void
  togglePresenter: () => void
  startPresentation: () => void
  togglePresentation: () => void
  firstTouch?: Touch
  lastTouch?: Touch
}

export const clientCssClasses: CSSClassToken[] = ['freya@overlay', 'freya@image', 'freya@svg', 'freya@svg-definitions']

function serializeTouchEvent(ev: TouchEvent): Touch {
  const touch = ev.touches[0]

  return {
    timestamp: Date.now(),
    x: touch.clientX,
    y: touch.clientY
  }
}

export function slideUrl(id: string, index: number, slidesPadding: number): string {
  return `/${id}/${index.toString().padStart(slidesPadding, '0')}`
}

// Update slide scaling according to the screen resolution
export function updateSlidesAppearance(width: number, height: number): void {
  const aspectRatio = width / height
  const currentWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
  const currentHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
  const currentAspectRatio = currentWidth / currentHeight

  let correction

  // Landscape
  if (currentWidth > currentHeight) {
    /*
      If the current ratio is smaller than the slides one, it means adapting on the width will not
      overflow on the height, otherwise let's use vertical black bars.
    */
    correction = currentAspectRatio < aspectRatio ? currentWidth / width : currentHeight / height
  } else {
    /*
      If the current ratio is smaller than the slides one, it means adapting on the height will not
      overflow on the height, otherwise let's use horizontal black bars.
    */
    correction = currentAspectRatio > aspectRatio ? currentHeight / height : currentWidth / width
  }

  // Round up to the third decimal
  let correctionUpped = correction * 100
  correctionUpped = correctionUpped % 1 < 0.5 ? Math.floor(correctionUpped) + 0.5 : Math.ceil(correctionUpped)

  document.body.style.setProperty('--freya-slide-transform', `scale(${(correctionUpped / 100).toFixed(3)})`)
}

export function updateSlide(context: DOMContext, modifier: number): void {
  const {
    id,
    talk: { slidesPadding, slidesCount }
  } = context
  const index = context.index + modifier

  if (index < 1 || index > slidesCount) {
    return
  }

  route(slideUrl(id, index, slidesPadding))
}

export function handleTouchStart(context: DOMContext, ev: TouchEvent): void {
  const speedTolerance = 500
  const movementTolerance = 100
  const currentTouch = serializeTouchEvent(ev)

  // Detect double tap for full screen toggling
  if (context.firstTouch) {
    const xShift = Math.abs(currentTouch.x - context.firstTouch.x)
    const yShift = Math.abs(currentTouch.y - context.firstTouch.y)

    if (
      Date.now() - context.firstTouch.timestamp < speedTolerance &&
      xShift < movementTolerance &&
      yShift < movementTolerance
    ) {
      ev.preventDefault()
      context.firstTouch = currentTouch
      handleFullScreen(ev)
      return
    }
  }

  context.firstTouch = currentTouch
}

export function handleTouchMove(context: DOMContext, ev: TouchEvent): void {
  context.lastTouch = serializeTouchEvent(ev)
}

export function handleTouchEnd(context: DOMContext): void {
  if (!context.firstTouch || !context.lastTouch) {
    return
  }

  const tolerance = 100
  const xShift = context.firstTouch.x - context.lastTouch.x
  const yShift = context.firstTouch.y - context.lastTouch.y
  const absoluteXShift = Math.abs(xShift)
  const absoluteYShift = Math.abs(yShift)
  let direction = ''

  if (absoluteXShift > tolerance && absoluteYShift < tolerance) {
    // Horizontal swipe
    direction = xShift < 0 ? 'previous' : 'next'
  } else if (absoluteYShift > tolerance && absoluteXShift < tolerance) {
    // Vertical swipe
    direction = yShift < 0 ? 'previous' : 'next'
  }

  updateSlide(context, direction === 'previous' ? -1 : +1)
}

export function handleFullScreen(ev: Event): void {
  if (typeof ev?.preventDefault === 'function') {
    ev.preventDefault()
  }

  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(error => {
      console.error(`Cannot go fullscreen: ${error.message}`)
    })
  } else {
    document.exitFullscreen().catch(error => {
      console.error(`Cannot exit fullscreen: ${error.message}`)
    })
  }
}

export function handleShortcut(context: DOMContext, ev: KeyboardEvent): void {
  const handlePrevious = updateSlide.bind(null, context, -1)
  const handleNext = updateSlide.bind(null, context, +1)

  // Setup shortcuts
  const shortcuts: Shortcuts = {
    ArrowLeft: handlePrevious,
    ArrowUp: handlePrevious,
    Backspace: handlePrevious,
    ArrowRight: handleNext,
    ArrowDown: handleNext,
    ' ': handleNext,
    Enter: handleFullScreen,
    Escape: context.handleEscape,
    Tab: context.toggleNavigator,
    g: context.toggleNavigator,
    l: context.toggleNavigator,
    p: context.togglePresenter,
    s: context.togglePresentation,
    t: context.startPresentation,
    f: handleFullScreen
  }

  const shiftShortcuts: Shortcuts = {
    Tab: context.togglePresenter,
    ' ': context.togglePresentation,
    Enter: context.togglePresentation
  }

  const handler = (ev.shiftKey ? shiftShortcuts : shortcuts)[ev.key]
  if (handler) {
    handler(ev)
  }
}
