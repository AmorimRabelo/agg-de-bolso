import { useNavigate } from 'react-router-dom'
import { formatDate } from '../../core/format'
import { Card } from '../../shared/components/ui'
import { hasAccess, trialDaysLeft } from './service'
import { useIsAdmin, useSubscription } from './hooks'

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  trial: { label: 'Teste grátis', color: 'bg-sky-100 text-sky-700' },
  ativa: { label: 'Ativa', color: 'bg-brand-100 text-brand-800' },
  inadimplente: { label: 'Pagamento pendente', color: 'bg-amber-100 text-amber-700' },
  bloqueada: { label: 'Bloqueada', color: 'bg-red-100 text-red-700' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-200 text-gray-500' },
}

export function SubscriptionPage() {
  const navigate = useNavigate()
  const { data: sub } = useSubscription()
  const { data: isAdmin } = useIsAdmin()

  return (
    <div className="px-5 pt-8 pb-6">
      <button onClick={() => navigate(-1)} className="mb-2 text-sm font-medium text-brand-700">
        ‹ Voltar
      </button>
      <h1 className="text-2xl font-extrabold">Minha assinatura</h1>

      {isAdmin ? (
        <Card className="mt-5 !bg-brand-50">
          <p className="font-semibold">👑 Conta de sócio</p>
          <p className="mt-1 text-sm text-ink/60">
            Acesso completo e vitalício — sem cobrança.
          </p>
        </Card>
      ) : (
        sub && (
          <>
            <Card className="mt-5">
              <div className="flex items-center justify-between">
                <p className="font-bold">Plano {sub.plan === 'essencial' ? 'Essencial' : 'Profissional'}</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[sub.status].color}`}
                >
                  {STATUS_BADGE[sub.status].label}
                </span>
              </div>
              {sub.status === 'trial' && (
                <p className="mt-2 text-sm text-ink/60">
                  {hasAccess(sub) ? (
                    <>
                      Restam <strong>{trialDaysLeft(sub)} dia{trialDaysLeft(sub) === 1 ? '' : 's'}</strong> do
                      seu teste grátis (até {formatDate(sub.trial_ends_at)})
                    </>
                  ) : (
                    <>Seu teste grátis terminou em {formatDate(sub.trial_ends_at)}</>
                  )}
                </p>
              )}
              {sub.status === 'ativa' && sub.paid_until && (
                <p className="mt-2 text-sm text-ink/60">
                  Válida até <strong>{formatDate(sub.paid_until)}</strong>
                </p>
              )}
            </Card>

            <Card className="mt-3">
              <p className="font-bold">Plano Essencial</p>
              <p className="mt-1 text-3xl font-extrabold text-brand-700">
                R$ 10<span className="text-base font-semibold text-ink/50">/mês</span>
              </p>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm text-ink/70">
                <li>✅ Clientes e empréstimos ilimitados</li>
                <li>✅ Parcelamento com multa e mora</li>
                <li>✅ Painel de rentabilidade e relatórios</li>
                <li>✅ Seus dados na nuvem, com backup</li>
              </ul>
            </Card>

            <Card className="mt-3 !bg-brand-50">
              <p className="text-sm font-semibold">Como ativar</p>
              <p className="mt-1 text-sm text-ink/70">
                O pagamento pelo app (PIX/cartão) está chegando. Por enquanto, a
                ativação é feita pelo nosso atendimento — entre em contato para
                liberar na hora.
              </p>
            </Card>
          </>
        )
      )}
    </div>
  )
}
