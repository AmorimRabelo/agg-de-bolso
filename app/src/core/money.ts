// Dinheiro SEMPRE em centavos (inteiros) dentro do app — nunca float.
// O banco usa NUMERIC(14,2); o Supabase envia/recebe como number com 2 casas,
// então convertemos na borda (services) e calculamos apenas com inteiros.

/** Converte valor do banco (ex.: 1500.5) para centavos (150050). */
export function toCents(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  return Math.round(Number(value) * 100)
}

/** Converte centavos para o valor aceito pelo banco (2 casas). */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100
}

/** Formata centavos como moeda brasileira: 150050 -> "R$ 1.500,50". */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

/** Interpreta texto digitado ("1.500,50" ou "1500,5" ou "1500.50") como centavos. */
export function parseBRL(text: string): number {
  const clean = text.replace(/[^\d,.-]/g, '')
  if (!clean) return 0
  // padrão brasileiro: ponto = milhar, vírgula = decimal
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean
  const n = Number(normalized)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** Máscara de digitação: mantém apenas dígitos e formata como moeda. */
export function maskMoneyInput(raw: string): { display: string; cents: number } {
  const digits = raw.replace(/\D/g, '')
  const cents = digits ? parseInt(digits, 10) : 0
  return { display: cents ? formatBRL(cents) : '', cents }
}

/** Percentual com 2 casas: 12.34 -> "12,34%". */
export function formatPct(value: number | string | null | undefined): string {
  const n = Number(value ?? 0)
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}
