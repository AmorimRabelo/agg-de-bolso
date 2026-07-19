import { useState } from 'react'
import dayjs from 'dayjs'
import { Navigate, useNavigate } from 'react-router-dom'
import { formatDate } from '../../core/format'
import { formatBRL, toCents } from '../../core/money'
import { Card, useToast } from '../../shared/components/ui'
import type { AdminMetrics, AdminSubscription, SignupPoint } from './service'
import {
  useAdminMetrics,
  useAdminSignups,
  useAdminSubscriptions,
  useAdminUpdateSubscription,
  useIsAdmin,
} from './hooks'

function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'brand' | 'warn' | 'danger'
}) {
  const color =
    tone === 'brand'
      ? 'text-brand-700'
      : tone === 'warn'
        ? 'text-amber-600'
        : tone === 'danger'
          ? 'text-red-600'
          : ''
  return (
    <Card className="!p-4">
      <p className="text-xs text-ink/40">{label}</p>
      <p className={`mt-0.5 text-xl font-extrabold ${color}`}>{value}</p>
      {hint && <p className="text-[11px] text-ink/40">{hint}</p>}
    </Card>
  )
}

function SignupsChart({ data }: { data: SignupPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.novos))
  const total = data.reduce((s, d) => s + d.novos, 0)
  return (
    <Card className="mt-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Cadastros — últimos 30 dias</p>
        <p className="text-xs text-ink/40">{total} no total</p>
      </div>
      <div className="mt-3 flex h-20 items-end gap-[3px]">
        {data.map((d) => (
          <div
            key={d.dia}
            title={`${formatDate(d.dia)}: ${d.novos}`}
            className="flex-1 rounded-t bg-brand-500"
            style={{ height: `${(d.novos / max) * 100}%`, minHeight: d.novos > 0 ? 3 : 1 }}
          />
        ))}
      </div>
    </Card>
  )
}

function MetricsDashboard({ m, signups }: { m: AdminMetrics; signups: SignupPoint[] }) {
  const trialConv =
    m.signups_30d > 0 ? Math.round((m.active / Math.max(m.signups_30d, 1)) * 100) : 0
  return (
    <>
      {/* receita em destaque */}
      <Card className="mt-4 !bg-gradient-to-br !from-brand-800 !to-brand-600 !text-white">
        <p className="text-xs text-brand-100">Receita recorrente mensal (MRR)</p>
        <p className="text-3xl font-extrabold">
          {(Number(m.mrr)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
        <p className="mt-1 text-xs text-brand-100">
          {m.active} assinatura{m.active === 1 ? '' : 's'} ativa{m.active === 1 ? '' : 's'} ·{' '}
          {(Number(m.mrr) * 12).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/ano
        </p>
      </Card>

      {/* assinaturas */}
      <p className="mt-4 text-sm font-bold text-ink/60">Assinaturas</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <StatCard label="Contas totais" value={String(m.total_accounts)} />
        <StatCard label="Ativas (pagantes)" value={String(m.active)} tone="brand" />
        <StatCard label="Em teste grátis" value={String(m.trial_active)} tone="warn" />
        <StatCard
          label="Teste vencido"
          value={String(m.trial_expired)}
          hint="alvo de conversão"
          tone="danger"
        />
      </div>

      {/* crescimento e uso */}
      <p className="mt-4 text-sm font-bold text-ink/60">Crescimento e uso</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <StatCard label="Novos (7 dias)" value={String(m.signups_7d)} tone="brand" />
        <StatCard label="Novos (30 dias)" value={String(m.signups_30d)} />
        <StatCard
          label="Ativos (7 dias)"
          value={String(m.active_users_7d)}
          hint="usaram o app"
        />
        <StatCard
          label="Conversão"
          value={`${trialConv}%`}
          hint="ativos ÷ novos 30d"
        />
      </div>

      <SignupsChart data={signups} />

      {/* volume gerido na plataforma */}
      <p className="mt-4 text-sm font-bold text-ink/60">Tração (carteira na plataforma)</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <StatCard label="Volume emprestado" value={formatBRL(toCents(m.volume_lent))} tone="brand" />
        <StatCard label="Volume recebido" value={formatBRL(toCents(m.volume_received))} />
        <StatCard label="Empréstimos" value={String(m.total_loans)} />
        <StatCard label="Clientes cadastrados" value={String(m.total_clients)} />
      </div>
    </>
  )
}

const BADGE: Record<string, string> = {
  trial: 'bg-sky-100 text-sky-700',
  trial_vencido: 'bg-amber-100 text-amber-700',
  ativa: 'bg-brand-100 text-brand-800',
  inadimplente: 'bg-amber-100 text-amber-700',
  bloqueada: 'bg-red-100 text-red-700',
  cancelada: 'bg-gray-200 text-gray-500',
}
const LABEL: Record<string, string> = {
  trial: 'Teste',
  trial_vencido: 'Teste vencido',
  ativa: 'Ativa',
  inadimplente: 'Inadimplente',
  bloqueada: 'Bloqueada',
  cancelada: 'Cancelada',
}

export function AdminPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState<'painel' | 'assinantes'>('painel')
  const { data: isAdmin, isLoading: loadingAdmin } = useIsAdmin()
  const { data: metrics } = useAdminMetrics()
  const { data: signups } = useAdminSignups()
  const { data: subs, isLoading } = useAdminSubscriptions()
  const update = useAdminUpdateSubscription()

  if (!loadingAdmin && !isAdmin) return <Navigate to="/" replace />

  async function act(s: AdminSubscription, patch: Record<string, unknown>, msg: string) {
    try {
      await update.mutateAsync({ userId: s.user_id, patch })
      toast(msg)
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  return (
    <div className="px-5 pt-8 pb-6">
      <button onClick={() => navigate(-1)} className="mb-2 text-sm font-medium text-brand-700">
        ‹ Voltar
      </button>
      <h1 className="text-2xl font-extrabold">Painel dos sócios</h1>

      <div className="mt-3 flex gap-2">
        {(['painel', 'assinantes'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-2xl py-2 text-sm font-semibold transition
              ${tab === t ? 'bg-brand-700 text-white' : 'bg-white text-ink/60'}`}
          >
            {t === 'painel' ? '📊 Painel' : '👥 Assinantes'}
          </button>
        ))}
      </div>

      {tab === 'painel' &&
        (metrics && signups ? (
          <MetricsDashboard m={metrics} signups={signups} />
        ) : (
          <div className="mt-4 h-40 animate-pulse rounded-3xl bg-ink/5" />
        ))}

      {tab === 'assinantes' && (
      <div className="mt-4 flex flex-col gap-3">
        {isLoading &&
          [1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-3xl bg-ink/5" />)}

        {(subs ?? []).map((s) => (
          <Card key={s.id} className="!p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{s.full_name || s.email}</p>
                <p className="truncate text-xs text-ink/50">{s.email}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE[s.effective_status]}`}
              >
                {LABEL[s.effective_status]}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-ink/50">
              {s.effective_status === 'trial' && `Teste até ${formatDate(s.trial_ends_at)} (${s.trial_days_left}d)`}
              {s.effective_status === 'ativa' && s.paid_until && `Paga até ${formatDate(s.paid_until)}`}
              {s.effective_status === 'trial_vencido' && `Teste venceu em ${formatDate(s.trial_ends_at)}`}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  act(
                    s,
                    { status: 'ativa', paid_until: dayjs().add(31, 'day').format('YYYY-MM-DD') },
                    'Assinatura ativada por 31 dias ✅',
                  )
                }
                className="rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white"
              >
                ✓ Ativar +31d
              </button>
              <button
                onClick={() =>
                  act(
                    s,
                    { status: 'trial', trial_ends_at: dayjs().add(14, 'day').toISOString() },
                    'Teste grátis renovado por 14 dias',
                  )
                }
                className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-700"
              >
                + 14d teste
              </button>
              <button
                onClick={() => act(s, { status: 'bloqueada' }, 'Conta bloqueada')}
                className="rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700"
              >
                Bloquear
              </button>
            </div>
          </Card>
        ))}
      </div>
      )}
    </div>
  )
}
