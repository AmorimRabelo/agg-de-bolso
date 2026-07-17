import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { paymentsService } from './service'
import type { PaymentInput } from './types'

export function useAllPayments() {
  return useQuery({
    queryKey: ['payments', 'all'],
    queryFn: paymentsService.listAllActive,
  })
}

export function useClientPayments(clientId: string | undefined) {
  return useQuery({
    queryKey: ['payments', 'client', clientId],
    queryFn: () => paymentsService.listByClient(clientId!),
    enabled: !!clientId,
  })
}

export function usePayments(loanId: string | undefined) {
  return useQuery({
    queryKey: ['payments', loanId],
    queryFn: () => paymentsService.listByLoan(loanId!),
    enabled: !!loanId,
  })
}

function useInvalidateAll() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['payments'] })
    qc.invalidateQueries({ queryKey: ['loans'] })
    qc.invalidateQueries({ queryKey: ['clients'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

export function useCreatePayment() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: PaymentInput) => paymentsService.create(input),
    onSuccess: invalidate,
  })
}

export function useCancelPayment() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      paymentsService.cancel(id, reason),
    onSuccess: invalidate,
  })
}
