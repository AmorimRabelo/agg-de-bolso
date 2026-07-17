import dayjs from 'dayjs'
import 'dayjs/locale/pt-br'

dayjs.locale('pt-br')

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return dayjs(date).format('DD/MM/YYYY')
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return dayjs(date).format('DD/MM/YYYY HH:mm')
}

export function todayISO(): string {
  return dayjs().format('YYYY-MM-DD')
}

export function formatCpfCnpj(value: string | null | undefined): string {
  if (!value) return '—'
  const d = value.replace(/\D/g, '')
  if (d.length === 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14)
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return value
}

export function formatPhone(value: string | null | undefined): string {
  if (!value) return '—'
  const d = value.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return value
}

/** Primeiro nome, para saudações. */
export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] || ''
}
