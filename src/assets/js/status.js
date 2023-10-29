document.addEventListener('DOMContentLoaded', () => {
  const pendingMessage = document.querySelector('#pending')
  const errorContainer = document.querySelector('#error')
  const errorContents = document.querySelector('#error-content')
  const events = new EventSource('/__status')

  events.addEventListener('sync', ev => {
    const update = JSON.parse(ev.data)

    switch (update.status) {
      case 'pending':
        pendingMessage.classList.remove('hidden')
        errorContainer.classList.add('hidden')
        errorContents.innerHTML = ''
        break
      case 'success':
        location.reload()
        break
      case 'failed':
        pendingMessage.classList.add('hidden')
        errorContainer.classList.remove('hidden')
        errorContents.innerHTML = update.payload.error
        break
    }
  })

  events.addEventListener('end', e => {
    events.close()
  })

  events.addEventListener('error', event => {
    console.error('Receiving synchronization failed', event)
  })
})
