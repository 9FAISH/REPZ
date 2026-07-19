/* Imported into the generated service worker via workbox importScripts.
   Relays rest-timer notification action taps back to the app window. */
self.addEventListener('notificationclick', (event) => {
  const data = event.notification && event.notification.data
  if (!data || data.kind !== 'repz-rest-timer') return
  const action = event.action || 'skip' // body tap = open app & skip
  if (action === 'skip' || action === 'done-set') event.notification.close()
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const client = clients[0]
      if (client) {
        client.postMessage({ type: 'repz-notif-action', action })
        if ('focus' in client) await client.focus()
      } else if (self.clients.openWindow) {
        await self.clients.openWindow('./')
      }
    })(),
  )
})
