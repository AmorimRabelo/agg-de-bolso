/// <reference lib="webworker" />
// Service worker do Agg de Bolso:
// - cache/atualização automática do app (Workbox)
// - recebimento de notificações push (mesmo com o app fechado)
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// ---- PUSH: mostra a notificação ------------------------------
self.addEventListener('push', (event) => {
  if (!event.data) return
  let data: { title?: string; body?: string; url?: string } = {}
  try {
    data = event.data.json()
  } catch {
    data = { body: event.data.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Agg de Bolso', {
      body: data.body ?? '',
      icon: './pwa-192x192.png',
      badge: './pwa-192x192.png',
      data: { url: data.url ?? '/' },
      tag: 'agg-cobrancas', // agrupa: só a mais recente fica visível
    }),
  )
})

// ---- Toque na notificação: abre a central de cobranças -------
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data?.url as string) ?? '/'
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = all[0]
      if (existing) {
        await existing.focus()
        existing.navigate(new URL(url, self.location.origin).href)
      } else {
        await self.clients.openWindow(url)
      }
    })(),
  )
})
