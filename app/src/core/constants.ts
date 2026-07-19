// Enums e rótulos — espelham os CHECKs criados no banco (001_tabelas.sql)

export const CLIENT_STATUS = {
  ativo: { label: 'Ativo', color: 'bg-brand-100 text-brand-800' },
  bloqueado: { label: 'Bloqueado', color: 'bg-red-100 text-red-700' },
  inativo: { label: 'Inativo', color: 'bg-gray-200 text-gray-600' },
} as const
export type ClientStatus = keyof typeof CLIENT_STATUS

export const LOAN_STATUS = {
  em_aberto: { label: 'Em aberto', color: 'bg-sky-100 text-sky-700' },
  parcial: { label: 'Parcialmente pago', color: 'bg-amber-100 text-amber-700' },
  pago: { label: 'Pago', color: 'bg-brand-100 text-brand-800' },
  atrasado: { label: 'Atrasado', color: 'bg-red-100 text-red-700' },
  cancelado: { label: 'Cancelado', color: 'bg-gray-200 text-gray-500' },
} as const
export type LoanStatus = keyof typeof LOAN_STATUS

export const TRAFFIC_LIGHT = {
  verde: { emoji: '🟢', label: 'Em dia' },
  amarelo: { emoji: '🟡', label: 'Vence hoje' },
  laranja: { emoji: '🟠', label: 'Atrasado' },
  vermelho: { emoji: '🔴', label: 'Muito atrasado' },
  neutro: { emoji: '', label: '' },
} as const
export type TrafficLight = keyof typeof TRAFFIC_LIGHT

export const LOAN_TYPE = {
  unico: 'Único',
  parcelado: 'Parcelado',
} as const
export type LoanType = keyof typeof LOAN_TYPE

export const PERIODICITY = {
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
} as const
export type Periodicity = keyof typeof PERIODICITY

export const CALC_MODE = {
  juros_simples: 'Juros simples',
  price: 'Price (parcela fixa)',
} as const
export type CalcMode = keyof typeof CALC_MODE

export const INSTALLMENT_STATUS = {
  aberta: { label: 'Em aberto', color: 'bg-sky-100 text-sky-700' },
  parcial: { label: 'Parcial', color: 'bg-amber-100 text-amber-700' },
  paga: { label: 'Paga', color: 'bg-brand-100 text-brand-800' },
  atrasada: { label: 'Atrasada', color: 'bg-red-100 text-red-700' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-200 text-gray-500' },
} as const
export type InstallmentStatus = keyof typeof INSTALLMENT_STATUS

export const PAYMENT_METHODS = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  boleto: 'Boleto',
  outro: 'Outro',
} as const
export type PaymentMethod = keyof typeof PAYMENT_METHODS
