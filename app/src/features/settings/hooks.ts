import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsService, type SettingsInput } from './service'

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: settingsService.get })
}

export function useSaveSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SettingsInput) => settingsService.update(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}
