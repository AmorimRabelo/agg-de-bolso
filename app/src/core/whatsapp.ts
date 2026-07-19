import { formatBRL } from './money'
import { formatDate, firstName } from './format'

/** Monta o link wa.me com a mensagem de cobrança pronta. */
export function whatsappChargeLink(opts: {
  whatsapp: string | null | undefined
  clientName: string
  amountCents: number
  dueDate: string
  daysLate: number
  installmentNumber?: number | null
  companyName?: string | null
}): string | null {
  const digits = (opts.whatsapp ?? '').replace(/\D/g, '')
  if (!digits) return null
  // adiciona o DDI do Brasil se ainda não tiver
  const phone = digits.startsWith('55') ? digits : `55${digits}`

  const oque = opts.installmentNumber
    ? `da parcela ${opts.installmentNumber}`
    : 'do empréstimo'
  const assinatura = opts.companyName ? `\n\n— ${opts.companyName}` : ''
  const msg =
    `Olá, ${firstName(opts.clientName)}! Tudo bem?\n\n` +
    `Passando para lembrar ${oque} no valor de ${formatBRL(opts.amountCents)}, ` +
    `com vencimento em ${formatDate(opts.dueDate)} ` +
    `(${opts.daysLate} dia${opts.daysLate === 1 ? '' : 's'} em atraso).\n\n` +
    `Assim que possível, me avise sobre o pagamento. Fico à disposição!${assinatura}`

  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
}
