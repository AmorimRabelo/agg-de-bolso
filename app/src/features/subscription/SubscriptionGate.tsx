import { useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../../core/supabase'
import { Button, Card, Logo } from '../../shared/components/ui'
import { hasAccess } from './service'
import { useIsAdmin, useSubscription } from './hooks'

/**
 * Portão de assinatura: quando o teste grátis vence (ou a assinatura é
 * bloqueada), mostra o aviso de ativação. O usuário ainda pode continuar em
 * modo leitura — o banco (RLS) garante que nada novo é criado sem acesso.
 */
export function SubscriptionGate({ children }: { children: ReactNode }) {
  const { data: sub } = useSubscription()
  const { data: isAdmin } = useIsAdmin()
  const [readOnly, setReadOnly] = useState(false)

  const blocked = !isAdmin && sub != null && !hasAccess(sub)
  if (!blocked || readOnly) return <>{children}</>

  const title =
    sub!.status === 'trial'
      ? 'Seu teste grátis terminou 🎁'
      : sub!.status === 'bloqueada' || sub!.status === 'inadimplente'
        ? 'Assinatura pendente'
        : 'Assinatura encerrada'

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-6 py-10">
      <div className="flex flex-col items-center gap-3">
        <Logo size={56} />
        <h1 className="text-center text-2xl font-extrabold">{title}</h1>
        <p className="text-center text-sm text-ink/60">
          Seus dados estão seguros e guardados. Para continuar registrando
          empréstimos e recebimentos, ative sua assinatura.
        </p>
      </div>

      <Card>
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

      <Card className="!bg-brand-50">
        <p className="text-sm font-semibold">Como ativar</p>
        <p className="mt-1 text-sm text-ink/70">
          O pagamento pelo app (PIX/cartão) está chegando. Por enquanto, a
          ativação é feita pelo nosso atendimento — entre em contato para
          liberar seu acesso na hora.
        </p>
      </Card>

      <div className="flex flex-col gap-2">
        <Button variant="ghost" onClick={() => setReadOnly(true)}>
          Continuar somente leitura
        </Button>
        <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
          <span className="text-ink/50">Sair da conta</span>
        </Button>
      </div>
    </div>
  )
}
