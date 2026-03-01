import { computed } from 'vue'
import { useQuery, useQueryClient, useMutation } from '@tanstack/vue-query'
import { fetchJson } from './api.js'

const USER_KEY = ['auth', 'user']

export const useUser = () => {
  const { data, isLoading } = useQuery({
    queryKey: USER_KEY,
    queryFn: async () => {
      const data = await fetchJson('/api/auth/me')
      return data.id ? data : null
    },
    staleTime: Infinity,
  })
  return { user: computed(() => data.value ?? null), isLoading }
}

export const useLogin = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => fetchJson('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (data) => qc.setQueryData(USER_KEY, data),
  })
}

export const useRegister = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => fetchJson('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (data) => qc.setQueryData(USER_KEY, data),
  })
}

export const useLogout = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => fetch('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => qc.setQueryData(USER_KEY, null),
  })
}
