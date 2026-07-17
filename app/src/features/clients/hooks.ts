import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clientsService } from './service'
import type { ClientInput } from './types'

export function useClients() {
  return useQuery({ queryKey: ['clients'], queryFn: clientsService.list })
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => clientsService.get(id!),
    enabled: !!id,
  })
}

export function useSaveClient(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ClientInput) =>
      id ? clientsService.update(id, input) : clientsService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: clientsService.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}
