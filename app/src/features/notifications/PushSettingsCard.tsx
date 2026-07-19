import { useEffect, useState } from 'react'
import { Button, Card, useToast } from '../../shared/components/ui'
import { pushService, type PushState } from './push'

/** Cartão dos Ajustes: ativar/desativar o aviso diário de cobranças. */
export function PushSettingsCard() {
  const toast = useToast()
  const [state, setState] = useState<PushState | 'loading'>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    pushService.state().then(setState)
  }, [])

  async function toggle() {
    setBusy(true)
    try {
      if (state === 'subscribed') {
        await pushService.unsubscribe()
        setState('off')
        toast('Notificações desativadas neste aparelho')
      } else {
        await pushService.subscribe()
        setState('subscribed')
        toast('Notificações ativadas ✅ Você será avisado dos atrasos')
      }
    } catch (err) {
      toast((err as Error).message, 'error')
      setState(await pushService.state())
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-4">
      <p className="font-semibold">🔔 Aviso diário de cobranças</p>
      <p className="mt-1 text-sm text-ink/60">
        Receba uma notificação no celular quando houver clientes em atraso — mesmo
        com o app fechado.
      </p>

      {state === 'loading' && <div className="mt-3 h-10 animate-pulse rounded-2xl bg-ink/5" />}

      {state === 'unsupported' && (
        <p className="mt-3 rounded-2xl bg-ink/5 p-3 text-xs text-ink/50">
          Este navegador não suporta notificações. No iPhone, instale o app pela opção
          <strong> Compartilhar → Adicionar à Tela de Início</strong> e ative por lá.
        </p>
      )}

      {state === 'denied' && (
        <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs text-amber-700">
          As notificações estão bloqueadas nas configurações do aparelho. Libere a
          permissão de notificações para este app e tente novamente.
        </p>
      )}

      {(state === 'off' || state === 'subscribed') && (
        <div className="mt-3">
          <Button
            variant={state === 'subscribed' ? 'ghost' : 'primary'}
            onClick={toggle}
            loading={busy}
          >
            {state === 'subscribed' ? (
              <span className="text-red-600">Desativar neste aparelho</span>
            ) : (
              'Ativar notificações'
            )}
          </Button>
          {state === 'subscribed' && (
            <p className="mt-2 text-center text-xs text-brand-700">✓ Ativas neste aparelho</p>
          )}
        </div>
      )}
    </Card>
  )
}
