document.addEventListener('DOMContentLoaded', () => {
  const events = new EventSource('/__status')
  let lastStatus = null

  events.addEventListener('sync', ev => {
    const update = JSON.parse(ev.data)

    // When the status has changed
    if (lastStatus && update.status !== lastStatus && ['success', 'failed'].includes(update.status)) {
      // Wait for some time before reloading. For most talks this will end up reloading when compilation has ended.
      setTimeout(() => {
        location.reload()
      }, 500)
    }

    lastStatus = update.status
  })

  events.addEventListener('end', e => {
    events.close()
  })

  events.addEventListener('error', event => {
    console.error('Receiving synchronization failed', event)
  })
})
