import type { ClientContext, Talk, Theme } from '../slidesets/models.ts'
import { route } from 'preact-router'

type Shortcuts = Record<string, (...args: any[]) => void>

export interface DOMContext {
  loaded: boolean
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
  if (!context.loaded) {
    return
  }

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
  if (!context.loaded) {
    if (!ev.metaKey && !ev.ctrlKey && !ev.shiftKey && ['Enter', 'f'].includes(ev.key)) {
      handleFullScreen(ev)
    } else {
      ev.preventDefault()
    }
    return
  }

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

/** Load declared font faces before mounting, including faces not yet used by any DOM element. */
export async function prepareFonts(): Promise<void> {
  if (!document.fonts) {
    return
  }

  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const fonts: Promise<FontFace>[] = []
    document.fonts.forEach(font => {
      fonts.push(font.load())
    })

    await Promise.race([
      Promise.allSettled(fonts),
      new Promise<void>(resolve => {
        // A slow or unavailable font must not prevent the presentation from opening.
        timeout = setTimeout(resolve, 10000)
      })
    ])
  } catch (error) {
    console.error('Preparing presentation fonts failed.', error)
  } finally {
    clearTimeout(timeout)
  }
}

export function setupServiceWorker(
  context: ClientContext,
  onChange: (state: Pick<ClientContext, 'loaded' | 'loadingProgress'>) => void
): () => void {
  if (context.isExporting || !context.serviceWorkerEnabled || !navigator.serviceWorker) {
    onChange({ loaded: true, loadingProgress: undefined })
    return () => {}
  }

  const workers = navigator.serviceWorker
  const scriptURL = new URL(`/${context.id}/sw.js`, location.href).href

  let finished = false
  let watchdog: ReturnType<typeof setTimeout>

  function finish(): void {
    if (finished) {
      return
    }

    finished = true
    onChange({ loaded: true, loadingProgress: undefined })

    clearTimeout(watchdog)
    workers.removeEventListener('controllerchange', subscribe)
    // Keep receiving version updates until the application unmounts.
  }

  function keepAlive(): void {
    clearTimeout(watchdog)
    // Progress heartbeats extend the wait, even on very slow connections.
    watchdog = setTimeout(finish, 30000)
  }

  function subscribe(): void {
    if (!finished && workers.controller?.scriptURL === scriptURL) {
      workers.controller.postMessage({ type: 'subscribe', talk: context.id })
    }
  }

  function receive(event: MessageEvent): void {
    const { type, payload } = event.data ?? {}

    if (!context.isProduction) {
      console.debug('Received message from service worker:', event.data)
    }

    if (event.source !== workers.controller || workers.controller?.scriptURL !== scriptURL) {
      return
    }

    if (type === 'new-version-available' && payload?.version && payload.version !== context.version) {
      console.log(`New version available: ${payload.version} (current is ${context.version}). Reloading the page.`)
      location.reload()
      return
    }

    if (
      finished ||
      !['progress', 'completed'].includes(type) ||
      payload?.talk !== context.id ||
      // An older controller may answer while the current build's worker is installing.
      payload.version !== context.version
    ) {
      return
    }

    if (type === 'progress') {
      const progress = payload.total > 0 ? (payload.processed / payload.total) * 100 : 100
      onChange({
        loaded: false,
        loadingProgress: Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0
      })
    }

    // Keep the protocol available to a future loading UI without coupling it to rendering.
    window.dispatchEvent(new CustomEvent('freya:preload', { detail: event.data }))

    keepAlive()

    if (type === 'completed') {
      finish()
    }
  }

  workers.addEventListener('controllerchange', subscribe)
  workers.addEventListener('message', receive)
  keepAlive()

  workers
    .register(scriptURL)
    .then(registration => {
      // A hard reload can bypass an already active worker without triggering activation again.
      if (!workers.controller && registration.active?.state === 'activated') {
        finish()
        return
      }

      subscribe()
    })
    .catch(error => {
      console.error('Registering talk service worker failed.', error)
      finish()
    })

  return () => {
    finished = true
    clearTimeout(watchdog)
    workers.removeEventListener('controllerchange', subscribe)
    workers.removeEventListener('message', receive)
  }
}
