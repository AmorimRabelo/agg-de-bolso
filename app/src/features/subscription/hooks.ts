import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subscriptionService, type Subscription } from './service'

export function useSubscription() {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: subscriptionService.getMine,
    staleTime: 60_000,
  })
}

export function useIsAdmin() {
  return useQuery({
    queryKey: ['subscription', 'admin'],
    queryFn: subscriptionService.amIAdmin,
    staleTime: 5 * 60_000,
  })
}

export function useAdminSubscriptions() {
  return useQuery({
    queryKey: ['subscription', 'admin-list'],
    queryFn: subscriptionService.adminList,
  })
}

export function useAdminMetrics() {
  return useQuery({
    queryKey: ['subscription', 'admin-metrics'],
    queryFn: subscriptionService.adminMetrics,
    staleTime: 60_000,
  })
}

export function useAdminSignups() {
  return useQuery({
    queryKey: ['subscription', 'admin-signups'],
    queryFn: subscriptionService.adminSignupsSeries,
    staleTime: 60_000,
  })
}

export function useAdminUpdateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, patch }: { userId: string; patch: Partial<Subscription> }) =>
      subscriptionService.adminUpdate(userId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscription'] }),
  })
}
