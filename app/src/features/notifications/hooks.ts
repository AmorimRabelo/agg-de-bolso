import { useQuery } from '@tanstack/react-query'
import { notificationsService } from './service'

export function useOverdue() {
  return useQuery({
    queryKey: ['notifications', 'overdue'],
    queryFn: notificationsService.overdue,
    staleTime: 60_000,
  })
}
