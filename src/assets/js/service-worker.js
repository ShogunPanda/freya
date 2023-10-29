document.addEventListener('DOMContentLoaded', () => {
  // Service workers
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', event => {
      const { type, payload } = event.data

      if (type === 'new-version-available' && payload.version !== globalThis.__freyaSiteVersion) {
        console.log(`New version available: ${payload.version}. Reloading the page.`)
        location.reload()
      }
    })

    navigator.serviceWorker.register('/sw.js').catch(console.error)
  }
})
