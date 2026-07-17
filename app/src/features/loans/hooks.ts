import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { loansService } from './service'
import type { LoanInput } from './types'

export function useLoans() {
  return useQuery({ queryKey: ['loans'], queryFn: loansService.list })
}

export function useLoansByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['loans', 'client', clientId],
    queryFn: () => loansService.listByClient(clientId!),
    enabled: !!clientId,
  })
}

export function useLoan(id: string | undefined) {
  return useQuery({
    queryKey: ['loans', id],
    queryFn: () => loansService.get(id!),
    enabled: !!id,
  })
}

function useInvalidateAll() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['loans'] })
    qc.invalidateQueries({ queryKey: ['clients'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

export function useSaveLoan(id?: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: LoanInput) =>
      id ? loansService.update(id, input) : loansService.create(input),
    onSuccess: invalidate,
  })
}

export function useCancelLoan() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      loansService.cancel(id, reason),
    onSuccess: invalidate,
  })
}
