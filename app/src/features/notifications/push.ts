import { supabase } from '../../core/supabase'

// Chave PÚBLICA do push (a privada fica só no servidor — Supabase secrets)
const VAPID_PUBLIC_KEY =
  'BArwRa-02By3xYWK7nJwYaBE42fjFMPMGCdxMHZ3mEIiqWqbIPeB8xWCEPZL7DGLO5dVzs-gHCR623J35q17O8s'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'off'

export const pushService = {
  /** O aparelho/navegador suporta push? */
  supported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  },

  async state(): Promise<PushState> {
    if (!this.supported()) return 'unsupported'
    if (Notification.permission === 'denied') return 'denied'
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return sub ? 'subscribed' : 'off'
  },

  /** Pede permissão, inscreve o celular e salva o endereço no banco. */
  async subscribe(): Promise<void> {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('Permissão de notificação negada')

    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    })

    const json = sub.toJSON()
    const { data: session } = await supabase.auth.getSession()
    const userId = session.session?.user.id
    if (!userId) throw new Error('Sessão expirada')

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
      },
      { onConflict: 'endpoint' },
    )
    if (error) throw new Error('Não foi possível salvar a inscrição')
  },

  /** Cancela neste aparelho. */
  async unsubscribe(): Promise<void> {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  },
}
