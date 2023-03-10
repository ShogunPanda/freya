/* globals Pusher */

{
  const context = {}
  const pendingMessage = document.querySelector('#pending')
  const errorContainer = document.querySelector('#error')
  const errorContents = document.querySelector('#error-content')

  Pusher.logToConsole = true

  const pusher = new Pusher(context.key, {
    cluster: context.cluster,
    channelAuthorization: { endpoint: '/pusher/auth' }
  })

  context.channel = pusher.subscribe(`private-talks-${context.hostname}-build-status`)

  context.channel.bind('client-update', function (data) {
    switch (data.status) {
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
        errorContents.innerHTML = data.error
        break
    }
  })

  context.channel.bind('pusher:error', event => {
    console.error('Receiving synchronization failed', event)
  })
}
