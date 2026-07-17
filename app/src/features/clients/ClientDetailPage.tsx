import { Link, useNavigate, useParams } from 'react-router-dom'
import { CLIENT_STATUS } from '../../core/constants'
import { formatCpfCnpj, formatPhone } from '../../core/format'
import { formatBRL, formatPct, toCents } from '../../core/money'
import { Button, Card, useToast } from '../../shared/components/ui'
import { useClient, useDeleteClient } from './hooks'
import { useLoansByClient } from '../loans/hooks'
import { LoanCard } from '../loans/LoanCard'
import { ClientTimeline } from './ClientTimeline'

export function ClientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: c, isLoading } = useClient(id)
  const { data: loans } = useLoansByClient(id)
  const del = useDeleteClient()

  if (isLoading || !c) {
    return (
      <div className="px-5 pt-8">
        <div className="h-40 animate-pulse rounded-3xl bg-ink/5" />
      </div>
    )
  }

  const badge = CLIENT_STATUS[c.status]
  const stats = [
    { label: 'Total emprestado', value: formatBRL(toCents(c.total_lent)) },
    { label: 'Total recebido', value: formatBRL(toCents(c.total_received)) },
    { label: 'Principal recebido', value: formatBRL(toCents(c.paid_principal)) },
    { label: 'Juros recebidos', value: formatBRL(toCents(c.paid_interest)), highlight: true },
    { label: 'Saldo em aberto', value: formatBRL(toCents(c.pending_total)), warn: toCents(c.pending_total) > 0 },
    { label: 'Rentabilidade', value: formatPct(c.return_pct), highlight: true },
  ]

  async function handleDelete() {
    if (!confirm(`Excluir o cliente "${c!.name}"? Esta ação não pode ser desfeita.`)) return
    try {
      await del.mutateAsync(c!.id)
      toast('Cliente excluído')
      navigate('/clientes', { replace: true })
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  return (
    <div>
      <header className="bg-gradient-to-b from-brand-950 to-brand-800 px-5 pb-12 pt-8 text-white">
        <button onClick={() => navigate(-1)} className="mb-3 text-sm font-medium text-brand-200">
          ‹ Voltar
        </button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">{c.name}</h1>
            <p className="mt-0.5 text-sm text-brand-200">{formatCpfCnpj(c.cpf_cnpj)}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.color}`}>
            {badge.label}
          </span>
        </div>
        <div className="mt-3 flex gap-4 text-sm text-brand-100">
          {c.phone && <span>📞 {formatPhone(c.phone)}</span>}
          {c.whatsapp && (
            <a
              href={`https://wa.me/55${c.whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand-200 underline"
            >
              💬 WhatsApp
            </a>
          )}
        </div>
      </header>

      <div className="-mt-6 px-5">
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <Card key={s.label} className="anim-fade-up !p-4">
              <p className="text-xs text-ink/40">{s.label}</p>
              <p
                className={`mt-0.5 font-bold ${
                  s.warn ? 'text-amber-600' : s.highlight ? 'text-brand-700' : ''
                }`}
              >
                {s.value}
              </p>
            </Card>
          ))}
        </div>

        <Card className="mt-3 !p-4">
          <p className="text-xs text-ink/40">Empréstimos</p>
          <p className="font-bold">{c.loan_count}</p>
        </Card>

        {c.notes && (
          <Card className="mt-3">
            <p className="text-xs text-ink/40">Observações</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{c.notes}</p>
          </Card>
        )}

        <div className="mt-5 flex items-center justify-between">
          <h2 className="font-bold">Empréstimos</h2>
          {c.status === 'ativo' && (
            <Link
              to={`/emprestimos/novo?cliente=${c.id}`}
              className="rounded-2xl bg-brand-700 px-3.5 py-2 text-sm font-semibold text-white active:bg-brand-800"
            >
              + Novo
            </Link>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {(loans ?? []).length === 0 && (
            <Card className="flex flex-col items-center gap-1 py-8 text-center">
              <span className="text-3xl">💸</span>
              <p className="text-sm font-semibold">Nenhum empréstimo para este cliente</p>
            </Card>
          )}
          {(loans ?? []).map((l) => (
            <LoanCard key={l.id} loan={l} hideClient />
          ))}
        </div>

        <ClientTimeline clientId={c.id} />

        <div className="mt-5 flex flex-col gap-3 pb-8">
          <Link to={`/clientes/${c.id}/editar`}>
            <Button>Editar cliente</Button>
          </Link>
          {c.loan_count === 0 && (
            <Button variant="ghost" onClick={handleDelete} loading={del.isPending}>
              <span className="text-red-600">Excluir cliente</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
