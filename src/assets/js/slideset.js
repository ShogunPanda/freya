/* globals Pusher */

{
  function setupSlides(context) {
    // Load all the slides
    context.slidesNotes = new Map()
    context.slides = new Map(
      [...document.querySelectorAll('[data-freya-id="slide"]')].map(e => {
        e.classList.add('hidden')

        const index = Number.parseInt(e.dataset.freyaIndex, 10)
        context.slidesNotes.set(index, e.querySelector('[data-freya-id="slide-notes"]'))
        return [index, e]
      })
    )

    if (context.environment === 'development') {
      console.log('freya-slides context', context)
    }

    if (!context.export) {
      const boundUpdatesSlidesAppearance = updateSlidesAppearance.bind(null, context)
      window.addEventListener('resize', boundUpdatesSlidesAppearance)
      document.addEventListener('fullscreenchange', boundUpdatesSlidesAppearance)
      setTimeout(boundUpdatesSlidesAppearance, 10)
    }
  }

  function setupList(context) {
    context.list = document.querySelector('[data-freya-id="list:container"]')
    context.listSlides = new Map()

    // Setup appearance
    const list = document.querySelector('[data-freya-id="list"]')
    const wrapperStyle = window.getComputedStyle(document.querySelector('[data-freya-id="list:slide-wrapper"]'))

    const wrapperWidth =
      Number.parseInt(wrapperStyle.width, 10) -
      Number.parseInt(wrapperStyle.borderLeftWidth, 10) -
      Number.parseInt(wrapperStyle.borderRightWidth, 10)

    const scale = wrapperWidth / context.dimensions.width

    list.style.setProperty('--freya-slide-wrapper-height', `${wrapperWidth / context.aspectRatio}px`)
    list.style.setProperty('--freya-slides-slide-transform', `scale(${scale})`)

    // Copy thumbnails and set events
    for (const [index, slide] of context.slides) {
      const target = document.querySelector(`[data-freya-id="list:slide-wrapper"][data-freya-index="${index}"]`)

      const clone = slide.cloneNode(true)
      clone.classList.remove('hidden')
      target.prepend(clone)

      target.addEventListener('click', ev => {
        ev.preventDefault()
        updateCurrentSlide(context, index)
        toggleList(context, false)
      })

      context.listSlides.set(index, target)
    }

    // Setup events
    document.querySelector('[data-freya-id="list:close"]').addEventListener('click', ev => {
      ev.preventDefault()
      toggleList(context, false)
    })
  }

  function setupPresenter(context) {
    context.presenter = document.querySelector('[data-freya-id="presenter:container"]')
    context.presenterProgress = document.querySelector('[data-freya-id="presenter:progress"]')
    context.presenterTime = document.querySelector('[data-freya-id="presenter:time"]')
    // context.presenterPrevious = document.querySelector('[data-freya-id="presenter:previous"]')
    context.presenterCurrent = document.querySelector('[data-freya-id="presenter:current"]')
    context.presenterNext = document.querySelector('[data-freya-id="presenter:next"]')
    context.presenterNotes = document.querySelector('[data-freya-id="presenter:notes"]')

    // Setup appearance
    const layout = document.querySelector('[data-freya-id="presenter"]')
    const slidePreviewStyle = window.getComputedStyle(document.querySelector('[data-freya-id="presenter:next"]'))
    const slideCurrentStyle = window.getComputedStyle(document.querySelector('[data-freya-id="presenter:current"]'))

    const previewWidth = Number.parseInt(slidePreviewStyle.width, 10)
    const currentWidth = Number.parseInt(slideCurrentStyle.width, 10)
    const previewScale = previewWidth / context.dimensions.width
    const currentScale = currentWidth / context.dimensions.width

    layout.style.setProperty('--freya-presenter-slide-preview-height', `${previewWidth / context.aspectRatio}px`)
    layout.style.setProperty('--freya-presenter-slide-current-height', `${currentWidth / context.aspectRatio}px`)
    layout.style.setProperty('--freya-presenter-slide-preview-transform', `scale(${previewScale})`)
    layout.style.setProperty('--freya-presenter-slide-current-transform', `scale(${currentScale})`)

    // Setup events
    document.querySelector('[data-freya-id="presenter:close"]').addEventListener('click', ev => {
      ev.preventDefault()
      togglePresenter(context, false)
    })

    document.querySelector('[data-freya-id="presenter:toggle"]').addEventListener('click', ev => {
      ev.preventDefault()
      togglePresenterTimer(context)
    })

    document.querySelector('[data-freya-id="presenter:reset"]').addEventListener('click', ev => {
      ev.preventDefault()
      startPresenterTimer(context)
    })
  }

  function shouldUpdateSlide(context, current) {
    if (
      typeof current !== 'number' ||
      Number.isNaN(current) ||
      current < 1 ||
      current > context.total ||
      context.current === current
    ) {
      return false
    }

    return true
  }

  function setupLocalSynchronization(context) {
    context.localChannel = new BroadcastChannel('freya-slides')

    context.localChannel.addEventListener('message', ev => {
      const { id, current } = ev.data

      if (id !== context.id || !shouldUpdateSlide(context, current)) {
        return
      }

      updateCurrentSlide(context, current, true)
      window.dispatchEvent(new Event('freya:slide:syncReceived:local'))
    })

    window.addEventListener('freya:slide:changed', () => {
      if (isVisible(context.presenter)) {
        context.localChannel.postMessage({ id: context.id, current: context.current })
      }
    })
  }

  function setupPusherSynchronization(context) {
    Pusher.logToConsole = context.environment === 'development'

    const pusher = new Pusher(context.pusher.key, {
      cluster: context.pusher.cluster,
      channelAuthorization: { endpoint: '/pusher/auth' }
    })
    const url = new URL(location.href)

    context.remoteChannel = pusher.subscribe(
      `private-talks-${url.protocol.replace(':', '')}-${url.hostname}-${url.port}-${context.id}-${context.environment}`
    )

    context.remoteChannel.bind('client-update', function (data) {
      const { current } = data

      if (!shouldUpdateSlide(context, current)) {
        return
      }

      updateCurrentSlide(context, current, true)
      window.dispatchEvent(new Event('freya:slide:syncReceived:remote'))
    })

    context.remoteChannel.bind('pusher:subscription_error', event => {
      console.error('Subscription failed', event)
    })

    context.remoteChannel.bind('pusher:error', event => {
      console.error('Receiving synchronization failed', event)
    })

    window.addEventListener('freya:slide:changed', () => {
      if (isVisible(context.presenter)) {
        context.remoteChannel.trigger('client-update', { current: context.current })
      }
    })
  }

  function handleShortcut(context, ev) {
    // Setup shortcuts
    const shortcuts = {
      ArrowLeft: gotoPreviousSlide,
      ArrowUp: gotoPreviousSlide,
      Backspace: gotoPreviousSlide,
      ArrowRight: gotoNextSlide,
      ArrowDown: gotoNextSlide,
      ' ': gotoNextSlide,
      Enter: toggleFullScreen,
      Escape: closeOverlay,
      Tab: toggleList,
      g: toggleList,
      l: toggleList,
      p: togglePresenter,
      s: togglePresenterTimer,
      t: startPresenterTimer,
      f: toggleFullScreen
    }

    const shiftShortcuts = {
      Tab: togglePresenter,
      ' ': togglePresenterTimer,
      Enter: togglePresenterTimer
    }

    const handler = (ev.shiftKey ? shiftShortcuts : shortcuts)[ev.key]
    if (handler) {
      ev.preventDefault()
      handler(context)
    }
  }

  function serializeTouchEvent(ev) {
    const touch = ev.touches[0]

    return {
      timestamp: Date.now(),
      x: touch.clientX,
      y: touch.clientY
    }
  }

  function handleTouchStart(context, ev) {
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
        toggleFullScreen()
        return
      }
    }

    context.firstTouch = currentTouch
  }

  function handleTouchMove(context, ev) {
    context.lastTouch = serializeTouchEvent(ev)
  }

  function handleTouchEnd(context) {
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

    if (direction === 'previous') {
      gotoPreviousSlide(context)
    } else if (direction === 'next') {
      gotoNextSlide(context)
    }
  }

  function isVisible(container) {
    return container.classList.contains('hidden') === false
  }

  function gotoPreviousSlide(context) {
    if (context.current < 2) {
      return
    }

    updateCurrentSlide(context, context.current - 1)
  }

  function gotoNextSlide(context) {
    if (context.current >= context.slidesCount) {
      return
    }

    updateCurrentSlide(context, context.current + 1)
  }

  function updateSlidesAppearance(context) {
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
      correction =
        currentAspectRatio < context.aspectRatio
          ? currentWidth / context.dimensions.width
          : currentHeight / context.dimensions.height
    } else {
      /*
        If the current ratio is smaller than the slides one, it means adapting on the height will not
        overflow on the height, otherwise let's use horizontal black bars.
      */
      correction =
        currentAspectRatio > context.aspectRatio
          ? currentHeight / context.dimensions.height
          : currentWidth / context.dimensions.width
    }

    // Round up to the third decimal
    let correctionUpped = correction * 100
    correctionUpped = correctionUpped % 1 < 0.5 ? Math.floor(correctionUpped) + 0.5 : Math.ceil(correctionUpped)

    document.body.style.setProperty('--freya-slide-transform', `scale(${(correctionUpped / 100).toFixed(3)})`)
  }

  function updateCurrentSlide(context, current, syncing, inTransition) {
    if (!inTransition && !context.export && typeof document.startViewTransition === 'function') {
      document.startViewTransition(() => updateCurrentSlide(context, current, syncing, true))
      return
    }

    // Hide previously visible slide
    if (context.current > 0) {
      context.slides.get(context.current).classList.add('hidden')
      context.listSlides.get(context.current).classList.remove('active')
    }

    // Update the current visible slide, the list and the presenter
    context.current = current
    context.slides.get(context.current).classList.remove('hidden')
    context.listSlides.get(context.current).classList.add('active')
    updatePresenter(context)

    // Update title and URL
    const paddedSlide = context.current.toString().padStart(context.slidesPadding, '0')
    window.history.pushState({}, '', `/${context.id}/${paddedSlide}`)
    document.title = `${paddedSlide} - ${context.title}`
    document.body.style.setProperty(
      '--freya-slide-progress',
      `${((context.current / context.slidesCount) * 100).toFixed(2)}`
    )
    window.dispatchEvent(new Event('freya:slide:changed'))
  }

  function updatePresenter(context) {
    // context.presenterPrevious.innerHTML = ''
    context.presenterCurrent.innerHTML = ''
    context.presenterNext.innerHTML = ''
    context.presenterNotes.innerHTML = ''

    if (context.current > 1) {
      const slide = context.slides.get(context.current - 1).cloneNode(true)
      slide.classList.remove('hidden')
      // context.presenterPrevious.append(slide)
    }

    context.presenterCurrent.append(context.slides.get(context.current).cloneNode(true))
    context.presenterNotes.append(context.slidesNotes.get(context.current).content.cloneNode(true))

    if (context.current < context.slidesCount) {
      const slide = context.slides.get(context.current + 1).cloneNode(true)
      slide.classList.remove('hidden')
      context.presenterNext.append(slide)
    }

    const paddedSlide = context.current.toString().padStart(context.slidesPadding, '0')
    context.presenterProgress.innerHTML = `${paddedSlide}/${context.slidesCount}`
  }

  function updatePresenterTimer(context) {
    context.presenterCurrentTime++

    const hour = Math.floor(context.presenterCurrentTime / 60)
      .toString()
      .padStart(2, '0')
    const minute = (context.presenterCurrentTime % 60).toString().padStart(2, '0')

    context.presenterTime.innerHTML = `${hour}:${minute}`
    window.dispatchEvent(new Event('freya:presenter:timer:update'))
  }

  function closeOverlay(context) {
    if (isVisible(context.list)) {
      toggleList(context, false)
    } else {
      togglePresenter(context, false)
    }
  }

  function toggleList(context, visible) {
    if (typeof visible === 'boolean') {
      context.list.classList.toggle('hidden', !visible)
    } else {
      context.list.classList.toggle('hidden')
    }

    window.dispatchEvent(new Event('freya:list:toggled'))
  }

  function togglePresenter(context, visible) {
    if (isVisible(context.list) && visible !== false) {
      return
    }

    if (typeof visible === 'boolean') {
      context.presenter.classList.toggle('hidden', !visible)
    } else {
      context.presenter.classList.toggle('hidden')
    }

    if (isVisible(context.presenter)) {
      window.dispatchEvent(new Event('freya:slide:changed'))
      startPresenterTimer(context)
    } else {
      stopPresenterTimer(context)
    }

    window.dispatchEvent(new Event('freya:presenter:toggled'))
  }

  function startPresenterTimer(context, reset = true) {
    if (!isVisible(context.presenter)) {
      return
    }

    if (reset) {
      context.presenterCurrentTime = -1
      updatePresenterTimer(context)
    }

    if (context.presenterInterval) {
      clearInterval(context.presenterInterval)
    }

    context.presenterInterval = setInterval(updatePresenterTimer.bind(null, context), 1000)
    window.dispatchEvent(new Event('freya:presenter:timer:started'))
  }

  function stopPresenterTimer(context) {
    if (!isVisible(context.presenter)) {
      return
    }

    clearInterval(context.presenterInterval)
    context.presenterInterval = null
    window.dispatchEvent(new Event('freya:presenter:timer:stopped'))
  }

  function togglePresenterTimer(context) {
    if (!isVisible(context.presenter)) {
      return
    }

    if (context.presenterInterval) {
      stopPresenterTimer(context)
    } else {
      startPresenterTimer(context, false)
    }
  }

  function toggleFullScreen(ev) {
    if (typeof ev?.preventDefault === 'function') {
      ev.preventDefault()
    }

    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .catch(error => console.error(`Cannot go fullscreen: ${error.message}`))
    } else {
      document.exitFullscreen()
    }
  }

  function start(context) {
    // Extract the current slide from the URL
    let current = Number.parseInt(new URL(location.href).pathname.split('/').at(-1), 10)

    if (Number.isNaN(current) || current < 1 || current > context.slidesCount) {
      current = 1
    }

    context.current = current

    updateCurrentSlide(context, current)
    document.querySelector('[data-freya-id="loading"]').remove()
    window.dispatchEvent(new Event('freya:ready'))
  }

  window.addEventListener('load', function () {
    const context = {}

    const params = new URLSearchParams(location.search)
    context.export = params.get('export') === 'true'

    // Setup elements
    setupSlides(context)
    setupList(context)
    setupPresenter(context)

    if (!context.export) {
      if (context.pusher) {
        setupPusherSynchronization(context)
      } else {
        setupLocalSynchronization(context)
      }
    }

    // Setup other events
    document.addEventListener('dblclick', toggleFullScreen, false)
    document.addEventListener('keydown', handleShortcut.bind(null, context), false)
    document.addEventListener('touchstart', handleTouchStart.bind(null, context), false)
    document.addEventListener('touchmove', handleTouchMove.bind(null, context), false)
    document.addEventListener('touchend', handleTouchEnd.bind(null, context), false)

    // Update the UI
    start(context)
  })
}