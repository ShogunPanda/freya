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

    if (!context.export) {
      window.addEventListener('resize', updateSlidesAppearance.bind(null, context))
      document.addEventListener('fullscreenchange', updateSlidesAppearance.bind(null, context))
      updateSlidesAppearance(context)
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

    list.style.setProperty('--nf-slide-wrapper-height', `${wrapperWidth / context.aspectRatio}px`)
    list.style.setProperty('--nf-slides-slide-transform', `scale(${scale})`)

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
    context.presenterPrevious = document.querySelector('[data-freya-id="presenter:previous"]')
    context.presenterCurrent = document.querySelector('[data-freya-id="presenter:current"]')
    context.presenterNext = document.querySelector('[data-freya-id="presenter:next"]')
    context.presenterNotes = document.querySelector('[data-freya-id="presenter:notes"]')

    // Setup appearance
    const layout = document.querySelector('[data-freya-id="presenter"]')
    const slidePreviewStyle = window.getComputedStyle(document.querySelector('[data-freya-id="presenter:previous"]'))
    const slideCurrentStyle = window.getComputedStyle(document.querySelector('[data-freya-id="presenter:current"]'))

    const previewWidth = Number.parseInt(slidePreviewStyle.width, 10)
    const currentWidth = Number.parseInt(slideCurrentStyle.width, 10)
    const previewScale = previewWidth / context.dimensions.width
    const currentScale = currentWidth / context.dimensions.width

    layout.style.setProperty('--nf-presenter-slide-preview-height', `${previewWidth / context.aspectRatio}px`)
    layout.style.setProperty('--nf-presenter-slide-current-height', `${currentWidth / context.aspectRatio}px`)
    layout.style.setProperty('--nf-presenter-slide-preview-transform', `scale(${previewScale})`)
    layout.style.setProperty('--nf-presenter-slide-current-transform', `scale(${currentScale})`)

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

  function setupSynchronization(context) {
    const events = new EventSource(`/${context.id}/sync`)

    events.addEventListener('sync', ev => {
      const { current } = JSON.parse(ev.data)

      if (
        typeof current !== 'number' ||
        Number.isNaN(current) ||
        current < 1 ||
        current > context.total ||
        context.current === current
      ) {
        return
      }

      updateCurrentSlide(context, current)
      window.dispatchEvent(new Event('freya:slide:syncReceived'))
    })

    events.addEventListener('end', e => {
      events.close()
    })

    events.addEventListener('error', event => {
      console.error('Receiving synchronization failed', event)
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
      Enter: gotoNextSlide,
      Escape: closeOverlay,
      g: toggleList,
      l: toggleList,
      p: togglePresenter,
      s: togglePresenterTimer,
      t: startPresenterTimer
    }

    const handler = shortcuts[ev.key]
    if (handler) {
      ev.preventDefault()
      handler(context)
    }
  }

  function isVisible(container) {
    return container.classList.contains('hidden') === false
  }

  function sendCurrentSlideUpdate(context) {
    fetch(`/${context.id}/sync/${context.current}`, { method: 'POST' }).catch(error => {
      console.error('Sending synchronization data failed', error)
    })
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

    const correction =
      currentWidth / currentHeight > context.aspectRatio
        ? currentHeight / context.dimensions.height
        : currentWidth / context.dimensions.width

    document.body.style.setProperty('--nf-slide-transform', `scale(${(correction * 0.9).toFixed(1)})`)
  }

  function updateCurrentSlide(context, current) {
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
    window.dispatchEvent(new Event('freya:slide:changed'))

    if (isVisible(context.presenter)) {
      sendCurrentSlideUpdate(context)
    }
  }

  function updatePresenter(context) {
    context.presenterPrevious.innerHTML = ''
    context.presenterCurrent.innerHTML = ''
    context.presenterNext.innerHTML = ''
    context.presenterNotes.innerHTML = ''

    if (context.current > 1) {
      const slide = context.slides.get(context.current - 1).cloneNode(true)
      slide.classList.remove('hidden')
      context.presenterPrevious.append(slide)
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
      sendCurrentSlideUpdate(context)
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
      setupSynchronization(context)
    }

    // Setup other events
    document.addEventListener('keydown', handleShortcut.bind(null, context), false)

    // Update the UI
    start(context)
  })
}
