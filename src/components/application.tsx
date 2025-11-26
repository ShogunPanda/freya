import { Fragment, render, type VNode } from 'preact'
import { route, Router, type RoutableProps, type RouterOnChangeArgs } from 'preact-router'
// eslint-disable-next-line import/order
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import Pusher, { type Channel } from 'pusher-js'
import { type ClientContext as ClientContextModel, type ParsedSVG } from '../slidesets/models.ts'
import { handleFullScreen, handleShortcut, slideUrl, updateSlidesAppearance, type DOMContext } from './client.ts'
import { ClientContextInstance, createClientContextValue, SlideContextInstance } from './contexts.tsx'
import { Controller } from './controller.tsx'
import { Navigator, Overlay } from './navigator.tsx'
import { Presenter } from './presenter.tsx'
import { LayoutContext, SlideComponent } from './slide.tsx'
import { SvgDefinitions } from './svg.tsx'

// @ts-expect-error Replaced at compile time
// eslint-disable-next-line @typescript-eslint/no-unused-expressions, camelcase
__replace_placeholder_imports__

function markdownParser(cache: Record<string, string>, raw?: string): string {
  raw = raw?.toString()

  return raw ? cache[raw] : ''
}

function resolveImageUrl(cache: Record<string, string>, theme: string, talk: string, url?: string): string {
  url = url?.toString()
  const key = `${theme}:${talk}:${url}`

  if (!url) {
    return ''
  }

  return cache[key]
}

function resolveSVG(cache: Record<string, ParsedSVG>, theme: string, talk: string, path?: string): ParsedSVG {
  path = path?.toString()
  const key = `${theme}:${talk}:${path}`

  if (!path) {
    return ['', undefined]
  }

  return cache[key]
}

function Application({ context }: { context: ClientContextModel } & RoutableProps): VNode | null {
  const {
    id,
    talk: {
      document: { title },
      slides,
      slidesPadding,
      slidesCount
    },
    isExporting
  } = context

  const [index, setIndex] = useState<number>()
  const [previousIndex, setPreviousIndex] = useState(0)
  const [isNavigating, setIsNavigating] = useState(false)
  const [isPresenting, setIsPresenting] = useState(false)
  const [isControlling, setIsControlling] = useState(window?.matchMedia('(hover: none)')?.matches)
  const [presentationDuration, setPresentationDuration] = useState(0)
  const [presentationPaused, setPresentationPaused] = useState(true)
  const localChannel = useRef<BroadcastChannel>()
  const remoteChannel = useRef<Channel>()
  // @ts-expect-error Invalid handling of moduleResolution
  const pusher = useRef<Pusher>()

  const slide = typeof index === 'number' ? slides[index - 1] : undefined

  const hookMethods = {
    resolveImage: resolveImageUrl.bind(null, context.assets.images),
    resolveSVG: resolveSVG.bind(null, context.assets.svgs),
    parseContent: markdownParser.bind(null, context.assets.content)
  }

  const toggleController = useCallback((ev?: Event) => {
    ev?.preventDefault()
    setIsControlling(current => !current)
    window.dispatchEvent(new Event('freya:controller:toggled'))
  }, [])

  const toggleNavigator = useCallback(
    (ev?: Event) => {
      ev?.preventDefault()
      setIsNavigating(current => !current)
      window.dispatchEvent(new Event('freya:navigator:toggled'))
    },
    [setIsNavigating]
  )

  const closeNavigator = useCallback(
    (ev?: Event) => {
      ev?.preventDefault()
      setIsNavigating(false)
      window.dispatchEvent(new Event('freya:navigator:toggled'))
    },
    [setIsNavigating]
  )

  const closePresenter = useCallback((ev?: Event) => {
    ev?.preventDefault()
    setIsPresenting(false)
    window.dispatchEvent(new Event('freya:presenter:toggled'))
  }, [])

  const togglePresenter = useCallback(
    (ev?: Event) => {
      ev?.preventDefault()
      setIsPresenting(current => !current)
      window.dispatchEvent(new Event('freya:presenter:toggled'))
    },
    [setIsPresenting]
  )

  const startPresentation = useCallback(
    (ev?: Event) => {
      ev?.preventDefault()

      setPresentationDuration(0)
      setPresentationPaused(false)
      window.dispatchEvent(new Event('freya:presenter:timer:started'))
    },
    [setPresentationDuration, setPresentationPaused]
  )

  const togglePresentation = useCallback(
    (ev?: Event) => {
      ev?.preventDefault()
      setPresentationPaused(current => !current)
      window.dispatchEvent(new Event('freya:presenter:timer:toggled'))
    },
    [setPresentationPaused]
  )

  const handleEscape = useCallback(
    (ev?: Event) => {
      ev?.preventDefault()

      if (isNavigating) {
        setIsNavigating(false)
        window.dispatchEvent(new Event('freya:navigator:toggled'))
      } else if (isPresenting) {
        setIsPresenting(false)
        window.dispatchEvent(new Event('freya:presenter:toggled'))
      }
    },
    [isNavigating, isPresenting, setIsNavigating, setIsPresenting]
  )

  // Setup route handling
  const handleRoute = useCallback(
    ({ matches }: RouterOnChangeArgs) => {
      const existingIndex = index

      let rawIndex = matches?.id

      if (!rawIndex) {
        rawIndex = '01'
      }

      const parsed = parseInt(rawIndex, 10)

      const current = isNaN(parsed) || parsed < 1 ? 1 : parsed
      setPreviousIndex(index ?? current)
      setIndex(current)

      if (existingIndex && isPresenting) {
        localChannel.current?.postMessage({ id, current })
        remoteChannel.current?.trigger('client-update', { id, current })
      }
    },
    [id, index, isPresenting, localChannel, setIndex, setPreviousIndex]
  )

  const handleSynchronizationUpdate = useCallback(
    (ev: MessageEvent) => {
      const { id: remoteId, current: rawCurrent } = ev.data
      const current = parseInt(rawCurrent as string, 10)

      if (id === remoteId && current !== index && !isPresenting) {
        route(slideUrl(id, current, slidesPadding))
        window.dispatchEvent(new MessageEvent('freya:slide:changed', { data: { id, index: current } }))
      }
    },
    [id, index, isPresenting, slidesPadding]
  )

  // Setup all DOM Events
  useEffect(() => {
    if (typeof index === 'undefined') {
      return
    }

    const domContext: DOMContext = {
      id: context.id,
      talk: context.talk,
      theme: context.theme,
      index,
      handleEscape,
      toggleController,
      toggleNavigator,
      togglePresenter,
      startPresentation,
      togglePresentation
    }

    const boundUpdateSlidesAppearance = updateSlidesAppearance.bind(
      null,
      context.dimensions.width,
      context.dimensions.height
    )

    const boundHandleShortcut = handleShortcut.bind(null, domContext)

    window.addEventListener('resize', boundUpdateSlidesAppearance, false)
    document.addEventListener('fullscreenchange', boundUpdateSlidesAppearance, false)
    document.addEventListener('dblclick', handleFullScreen, false)
    document.addEventListener('keydown', boundHandleShortcut, false)

    boundUpdateSlidesAppearance()
    window.dispatchEvent(new Event('freya:ready'))
    window.dispatchEvent(new Event('freya:controller:toggled'))
    document.body.style.setProperty('--freya-progress', `${((index / slidesCount) * 100).toFixed(2)}`)

    return () => {
      window.removeEventListener('resize', boundUpdateSlidesAppearance, false)
      document.removeEventListener('fullscreenchange', boundUpdateSlidesAppearance, false)
      document.removeEventListener('dblclick', handleFullScreen, false)
      document.removeEventListener('keydown', boundHandleShortcut, false)
    }
  }, [
    toggleNavigator,
    index,
    slidesCount,
    context,
    handleEscape,
    startPresentation,
    toggleController,
    togglePresenter,
    togglePresentation
  ])

  // Validate the initial slide
  useEffect(() => {
    if (typeof index === 'undefined') {
      return
    }

    if (index < 1 || index > slidesCount) {
      window.dispatchEvent(new MessageEvent('freya:slide:changed', { data: { id, index } }))
      route(`/${id}/${'1'.padStart(slidesPadding, '0')}`)
      return
    }

    document.title = `${index.toString().padStart(slidesPadding, '0')} - ${title}`
  }, [id, title, index, slidesCount, slidesPadding])

  // Track presentation duration if the timer is active
  useEffect(() => {
    const timer = setInterval(() => {
      if (!presentationPaused) {
        setPresentationDuration(current => current + 1)
      }
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [presentationPaused, setPresentationDuration])

  // Setup local synchronization if Pusher is not being used
  useEffect(() => {
    if (context.pusher) {
      return
    }

    localChannel.current = new BroadcastChannel('freya')
    localChannel.current.addEventListener('message', handleSynchronizationUpdate)

    return () => {
      localChannel.current?.removeEventListener('message', handleSynchronizationUpdate)
    }
  }, [localChannel, handleSynchronizationUpdate, isPresenting, context])

  // Setup pusher synchronization, if available
  useEffect(() => {
    if (!context.pusher) {
      return
    }

    if (!pusher.current) {
      // @ts-expect-error Invalid handling of moduleResolution
      Pusher.logToConsole = !context.isProduction

      // @ts-expect-error Invalid handling of moduleResolution
      pusher.current = new Pusher(context.pusher.key, {
        cluster: context.pusher.cluster,
        channelAuthorization: { transport: 'ajax', endpoint: '/pusher/auth' }
      })

      const { protocol, hostname, port } = new URL(location.href)
      const environment = context.isProduction ? 'production' : 'development'

      remoteChannel.current = pusher.current.subscribe(
        `private-talks-${protocol.replace(':', '')}-${hostname}-${port}-${environment}`
      )

      remoteChannel.current!.bind('pusher:subscription_error', (event: Event) => {
        console.error('Subscription failed', event)
      })

      remoteChannel.current!.bind('pusher:error', (event: Event) => {
        console.error('Receiving synchronization failed', event)
      })
    }

    remoteChannel.current!.bind('client-update', (data: Record<string, string>) => {
      handleSynchronizationUpdate(new MessageEvent('pusher', { data }))
    })

    return () => {
      remoteChannel.current!.unbind_all()
    }
  }, [pusher, remoteChannel, handleSynchronizationUpdate, context])

  return (
    <ClientContextInstance.Provider value={createClientContextValue(context, hookMethods)}>
      <Router onChange={handleRoute}>
        <Fragment path={`/${context.id}/:id?`} />
      </Router>

      {slide && index && (
        <SlideContextInstance.Provider value={{ slide, index, previousIndex }}>
          <SlideComponent />

          {(isNavigating || isPresenting) && <Overlay />}
          {isNavigating && <Navigator close={closeNavigator} />}
          {!isNavigating && isPresenting && (
            <Presenter
              close={closePresenter}
              paused={presentationPaused}
              duration={presentationDuration}
              startPresentation={startPresentation}
              togglePresentation={togglePresentation}
            />
          )}
          {!isExporting && isControlling && <Controller />}
        </SlideContextInstance.Provider>
      )}

      <SvgDefinitions definitions={context.assets.svgsDefinitions} />
    </ClientContextInstance.Provider>
  )
}

if (globalThis.document) {
  // @ts-expect-error Replaced at compile time
  // eslint-disable-next-line camelcase
  const context: ClientContextModel = ((globalThis as Record<string, unknown>).freya = __replace_placeholder_context__)

  // @ts-expect-error Replaced at compile time
  // eslint-disable-next-line camelcase
  const layouts = __replace_placeholder_layouts__

  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.remove('freya@loading')
    document.body.querySelector('h1')?.remove()

    render(
      <LayoutContext.Provider value={layouts}>
        <Application context={context} />
      </LayoutContext.Provider>,
      document.body
    )
  })

  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', event => {
      const { type, payload } = event.data

      if (type === 'new-version-available' && payload.version !== context.version) {
        console.log(`New version available: ${payload.version} (current is ${context.version}). Reloading the page.`)
        location.reload()
      }
    })

    navigator.serviceWorker.register(`/${context.id}/sw.js`).catch(console.error)
  }
}
