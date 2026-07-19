// AGG DE BOLSO — Robô diário de notificações de cobrança
// Verifica quem tem cliente em atraso e envia push para os celulares inscritos.
// Protegido por segredo (x-cron-secret) — só o agendador consegue disparar.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

Deno.serve(async (req) => {
  // segurança: só o cron (com o segredo) pode chamar
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  webpush.setVapidDetails(
    'mailto:contato@aggdebolso.app',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )

  // 1) atrasos por usuário (a view receivables já unifica únicos + parcelas)
  const { data: overdue, error: e1 } = await admin
    .from('receivables')
    .select('user_id, amount, days_late')
    .gt('days_late', 0)
  if (e1) return new Response(JSON.stringify({ error: e1.message }), { status: 500 })

  const byUser = new Map<string, { count: number; totalCents: number }>()
  for (const r of overdue ?? []) {
    const cur = byUser.get(r.user_id) ?? { count: 0, totalCents: 0 }
    cur.count += 1
    cur.totalCents += Math.round(Number(r.amount) * 100)
    byUser.set(r.user_id, cur)
  }

  if (byUser.size === 0) {
    return new Response(JSON.stringify({ ok: true, users: 0, sent: 0 }), { status: 200 })
  }

  // 2) inscrições de push desses usuários
  const { data: subs, error: e2 } = await admin
    .from('push_subscriptions')
    .select('*')
    .in('user_id', [...byUser.keys()])
  if (e2) return new Response(JSON.stringify({ error: e2.message }), { status: 500 })

  // 3) envia (e limpa inscrições mortas)
  let sent = 0
  let removed = 0
  const fmt = (c: number) =>
    (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  for (const sub of subs ?? []) {
    const info = byUser.get(sub.user_id)!
    const payload = JSON.stringify({
      title: `🔔 ${info.count} cobrança${info.count === 1 ? '' : 's'} em atraso`,
      body: `Total pendente: ${fmt(info.totalCents)}. Toque para cobrar pelo WhatsApp.`,
      url: '/#/notificacoes',
    })
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      sent++
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) {
        // celular desinscreveu/trocou — remove o endereço morto
        await admin.from('push_subscriptions').delete().eq('id', sub.id)
        removed++
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, users: byUser.size, sent, removed }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
