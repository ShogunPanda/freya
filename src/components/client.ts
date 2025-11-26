import { route } from 'preact-router'
import { type Talk, type Theme } from '../slidesets/models.ts'

type Shortcuts = Record<string, (...args: any[]) => void>

export interface DOMContext {
  id: string
  talk: Talk
  theme: Theme
  index: number
  handleEscape: () => void
  toggleController: () => void
  toggleNavigator: () => void
  togglePresenter: () => void
  startPresentation: () => void
  togglePresentation: () => void
}

export function slideUrl(id: string, index: number, slidesPadding: number): string {
  return `/${id}/${index.toString().padStart(slidesPadding, '0')}`
}

export function shouldAbortSlideChange(id: string, index: number): boolean {
  const event = new MessageEvent('freya:slide:changed', { data: { id, index, cancel: false } })
  window.dispatchEvent(event)
  return event.data.cancel
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

  if (shouldAbortSlideChange(id, index)) {
    return
  }

  route(slideUrl(id, index, slidesPadding))
}

export function handleFullScreen(ev?: Event): void {
  if (typeof ev?.preventDefault === 'function') {
    ev.preventDefault()
  }

  if (!document.fullscreenElement) {
    document.documentElement
      .requestFullscreen()
      .then(() => {
        window.dispatchEvent(new Event('freya:fullScreen:toggled'))
      })
      .catch(error => {
        console.error(`Cannot go fullscreen: ${error.message}`)
      })
  } else {
    document
      .exitFullscreen()
      .then(() => {
        window.dispatchEvent(new Event('freya:fullScreen:toggled'))
      })
      .catch(error => {
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
    c: context.toggleController,
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
  if (!ev.metaKey && !ev.ctrlKey && handler) {
    handler(ev)
  }
}
