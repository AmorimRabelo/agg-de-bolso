import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CLIENT_STATUS, type ClientStatus } from '../../core/constants'
import { formatBRL, toCents } from '../../core/money'
import { formatCpfCnpj } from '../../core/format'
import { Card } from '../../shared/components/ui'
import { useClients } from './hooks'

const FILTERS: Array<{ key: ClientStatus | 'todos'; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'ativo', label: 'Ativos' },
  { key: 'bloqueado', label: 'Bloqueados' },
  { key: 'inativo', label: 'Inativos' },
]

export function ClientsPage() {
  const navigate = useNavigate()
  const { data: clients, isLoading } = useClients()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ClientStatus | 'todos'>('todos')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (clients ?? []).filter((c) => {
      if (filter !== 'todos' && c.status !== filter) return false
      if (!term) return true
      return (
        c.name.toLowerCase().includes(term) ||
        (c.cpf_cnpj ?? '').replace(/\D/g, '').includes(term.replace(/\D/g, '') || '§')
      )
    })
  }, [clients, search, filter])

  return (
    <div className="px-5 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Clientes</h1>
        <Link
          to="/clientes/novo"
          className="rounded-2xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-700/20 active:bg-brand-800"
        >
          + Novo
        </Link>
      </div>

      <input
        className="mt-4 h-12 w-full rounded-2xl border border-ink/10 bg-white px-4 text-base outline-none placeholder:text-ink/30 focus:border-brand-600"
        placeholder="Buscar por nome ou CPF/CNPJ"
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

      <div className="mt-4 flex flex-col gap-3">
        {isLoading &&
          [1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-3xl bg-ink/5" />
          ))}

        {!isLoading && filtered.length === 0 && (
          <Card className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-4xl">👤</span>
            <p className="font-semibold">
              {search || filter !== 'todos'
                ? 'Nenhum cliente encontrado'
                : 'Nenhum cliente ainda'}
            </p>
            {!search && filter === 'todos' && (
              <p className="text-sm text-ink/50">
                Toque em <strong>+ Novo</strong> para cadastrar o primeiro
              </p>
            )}
          </Card>
        )}

        {filtered.map((c) => {
          const badge = CLIENT_STATUS[c.status]
          const pending = toCents(c.pending_total)
          return (
            <Card key={c.id} onClick={() => navigate(`/clientes/${c.id}`)} className="anim-fade-up">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="text-sm text-ink/50">{formatCpfCnpj(c.cpf_cnpj)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.color}`}>
                  {badge.label}
                </span>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-xs text-ink/40">Saldo em aberto</p>
                  <p className={`font-bold ${pending > 0 ? 'text-amber-600' : 'text-brand-700'}`}>
                    {formatBRL(pending)}
                  </p>
                </div>
                <p className="text-sm text-ink/50">
                  {c.loan_count} empréstimo{c.loan_count === 1 ? '' : 's'}
                </p>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
