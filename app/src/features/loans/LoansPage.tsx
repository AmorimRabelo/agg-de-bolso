import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../shared/components/ui'
import { useLoans } from './hooks'
import { LoanCard } from './LoanCard'

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'aberto', label: 'Em aberto' },
  { key: 'atrasado', label: 'Atrasados' },
  { key: 'pago', label: 'Pagos' },
  { key: 'cancelado', label: 'Cancelados' },
] as const
type FilterKey = (typeof FILTERS)[number]['key']

export function LoansPage() {
  const { data: loans, isLoading } = useLoans()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('todos')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const digits = term.replace(/\D/g, '')
    return (loans ?? []).filter((l) => {
      if (filter === 'aberto' && !['em_aberto', 'parcial', 'atrasado'].includes(l.effective_status)) return false
      if (filter === 'atrasado' && l.effective_status !== 'atrasado') return false
      if (filter === 'pago' && l.effective_status !== 'pago') return false
      if (filter === 'cancelado' && l.effective_status !== 'cancelado') return false
      if (!term) return true
      return (
        l.client_name.toLowerCase().includes(term) ||
        String(l.loan_number) === term ||
        (digits !== '' && (l.client_cpf_cnpj ?? '').includes(digits))
      )
    })
  }, [loans, search, filter])

  return (
    <div className="px-5 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Empréstimos</h1>
        <Link
          to="/emprestimos/novo"
          className="rounded-2xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 active:bg-brand-800"
        >
          + Novo
        </Link>
      </div>

      <input
        className="mt-4 h-12 w-full rounded-2xl border border-ink/10 bg-white px-4 text-base outline-none placeholder:text-ink/30 focus:border-brand-600"
        placeholder="Buscar por cliente, CPF ou número"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition
              ${filter === f.key ? 'bg-brand-700 text-white' : 'bg-white text-ink/60'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 pb-4">
        {isLoading &&
          [1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-3xl bg-ink/5" />)}

        {!isLoading && filtered.length === 0 && (
          <Card className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-4xl">💸</span>
            <p className="font-semibold">
              {search || filter !== 'todos' ? 'Nenhum empréstimo encontrado' : 'Nenhum empréstimo ainda'}
            </p>
            {!search && filter === 'todos' && (
              <p className="text-sm text-ink/50">
                Toque em <strong>+ Novo</strong> para registrar o primeiro
              </p>
            )}
          </Card>
        )}

        {filtered.map((l) => (
          <LoanCard key={l.id} loan={l} />
        ))}
      </div>
    </div>
  )
}
