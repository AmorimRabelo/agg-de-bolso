import { useQuery } from '@tanstack/react-query'
import { dashboardService } from './service'

export function useDashboardStats() {
  return useQuery({ queryKey: ['dashboard', 'stats'], queryFn: dashboardService.stats })
}

export function useRecentPayments() {
  return useQuery({ queryKey: ['dashboard', 'payments'], queryFn: dashboardService.recentPayments })
}

export function useUpcoming() {
  return useQuery({ queryKey: ['dashboard', 'upcoming'], queryFn: dashboardService.upcoming })
}

export function useLate() {
  return useQuery({ queryKey: ['dashboard', 'late'], queryFn: dashboardService.late })
}
