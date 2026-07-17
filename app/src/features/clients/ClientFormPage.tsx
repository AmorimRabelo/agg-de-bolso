import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CLIENT_STATUS, type ClientStatus } from '../../core/constants'
import { Button, Input, useToast } from '../../shared/components/ui'
import { useClient, useSaveClient } from './hooks'

function maskCpfCnpj(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11)
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2')
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}

export function ClientFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: existing } = useClient(id)
  const save = useSaveClient(id)

  const [name, setName] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<ClientStatus>('ativo')

  useEffect(() => {
    if (!existing) return
    setName(existing.name)
    setCpfCnpj(existing.cpf_cnpj ? maskCpfCnpj(existing.cpf_cnpj) : '')
    setPhone(existing.phone ? maskPhone(existing.phone) : '')
    setWhatsapp(existing.whatsapp ? maskPhone(existing.whatsapp) : '')
    setNotes(existing.notes ?? '')
    setStatus(existing.status)
  }, [existing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await save.mutateAsync({
        name: name.trim(),
        cpf_cnpj: cpfCnpj.replace(/\D/g, '') || null,
        phone: phone.replace(/\D/g, '') || null,
        whatsapp: whatsapp.replace(/\D/g, '') || null,
        notes: notes.trim() || null,
        status,
      })
      toast(id ? 'Cliente atualizado ✅' : 'Cliente cadastrado ✅')
      navigate(-1)
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  return (
    <div className="px-5 pt-8">
      <button onClick={() => navigate(-1)} className="mb-2 text-sm font-medium text-brand-700">
        ‹ Voltar
      </button>
      <h1 className="text-2xl font-extrabold">{id ? 'Editar cliente' : 'Novo cliente'}</h1>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4 pb-8">
        <Input
          label="Nome *"
          placeholder="Nome do cliente"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="CPF ou CNPJ"
          inputMode="numeric"
          placeholder="000.000.000-00"
          value={cpfCnpj}
          onChange={(e) => setCpfCnpj(maskCpfCnpj(e.target.value))}
        />
        <Input
          label="Telefone"
          inputMode="tel"
          placeholder="(00) 00000-0000"
          value={phone}
          onChange={(e) => setPhone(maskPhone(e.target.value))}
        />
        <Input
          label="WhatsApp"
          inputMode="tel"
          placeholder="(00) 00000-0000"
          value={whatsapp}
          onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
          hint="Se for o mesmo do telefone, repita aqui"
        />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink/70">Observações</span>
          <textarea
            className="min-h-24 w-full rounded-2xl border border-ink/10 bg-white p-4 text-base outline-none placeholder:text-ink/30 focus:border-brand-600"
            placeholder="Anotações sobre o cliente"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink/70">Status</span>
          <div className="flex gap-2">
            {(Object.keys(CLIENT_STATUS) as ClientStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`flex-1 rounded-2xl border py-2.5 text-sm font-semibold transition
                  ${status === s ? 'border-brand-700 bg-brand-700 text-white' : 'border-ink/10 bg-white text-ink/60'}`}
              >
                {CLIENT_STATUS[s].label}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" loading={save.isPending} className="mt-2">
          {id ? 'Salvar alterações' : 'Cadastrar cliente'}
        </Button>
      </form>
    </div>
  )
}
