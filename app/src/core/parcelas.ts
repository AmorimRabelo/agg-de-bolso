import dayjs from 'dayjs'

// Simulação de parcelas para PRÉVIA na tela.
// O cálculo oficial é feito pelo banco (trigger generate_installments) com a
// MESMA lógica — após salvar, o app exibe as parcelas geradas pelo banco.

export type CalcMode = 'price' | 'juros_simples'
export type Periodicity = 'semanal' | 'quinzenal' | 'mensal'

export interface SimInstallment {
  number: number
  dueDate: string
  principalCents: number
  interestCents: number
  totalCents: number
}

function addPeriod(date: string, periodicity: Periodicity, times: number): string {
  const d = dayjs(date)
  if (periodicity === 'semanal') return d.add(7 * times, 'day').format('YYYY-MM-DD')
  if (periodicity === 'quinzenal') return d.add(14 * times, 'day').format('YYYY-MM-DD')
  return d.add(times, 'month').format('YYYY-MM-DD')
}

export function simulateInstallments(opts: {
  principalCents: number
  n: number
  mode: CalcMode
  /** Price: % por período · Juros simples: % total do contrato */
  ratePct: number
  /** Juros simples: valor total de juros em centavos (alternativa à taxa) */
  interestTotalCents?: number
  firstDue: string
  periodicity: Periodicity
}): { installments: SimInstallment[]; interestTotalCents: number } {
  const { principalCents, n, mode, ratePct, firstDue, periodicity } = opts
  const out: SimInstallment[] = []

  if (mode === 'price') {
    const i = ratePct / 100
    const P = principalCents / 100
    const A = Math.round((P * i) / (1 - Math.pow(1 + i, -n)) * 100) // centavos
    let saldo = principalCents
    let jurosTotal = 0
    for (let k = 1; k <= n; k++) {
      const juros = Math.round((saldo / 100) * i * 100)
      const principal = k < n ? A - juros : saldo
      saldo -= principal
      jurosTotal += juros
      out.push({
        number: k,
        dueDate: addPeriod(firstDue, periodicity, k - 1),
        principalCents: principal,
        interestCents: juros,
        totalCents: principal + juros,
      })
    }
    return { installments: out, interestTotalCents: jurosTotal }
  }

  // juros simples
  const interestTotal =
    opts.interestTotalCents ?? Math.round((principalCents * ratePct) / 100)
  const basePrincipal = Math.floor(principalCents / n)
  const baseInterest = Math.floor(interestTotal / n)
  for (let k = 1; k <= n; k++) {
    const principal = k === n ? principalCents - basePrincipal * (n - 1) : basePrincipal
    const interest = k === n ? interestTotal - baseInterest * (n - 1) : baseInterest
    out.push({
      number: k,
      dueDate: addPeriod(firstDue, periodicity, k - 1),
      principalCents: principal,
      interestCents: interest,
      totalCents: principal + interest,
    })
  }
  return { installments: out, interestTotalCents: interestTotal }
}
