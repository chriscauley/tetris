import { computed } from 'vue'
import { useQuery, useQueryClient, useMutation } from '@tanstack/vue-query'
import { fetchJson } from './api.js'

const GAMES_KEY = ['lobby', 'games']
const CHAT_KEY = ['lobby', 'chat']

export const useGames = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: GAMES_KEY,
    queryFn: () => fetchJson('/api/lobby/games'),
    refetchInterval: 5000,
  })
  return { games: computed(() => data.value ?? []), isLoading, error }
}

export const useCreateGame = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => fetchJson('/api/lobby/games', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: GAMES_KEY }),
  })
}

export const useJoinGame = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => fetchJson(`/api/lobby/games/${id}/join`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: GAMES_KEY }),
  })
}

export const useChat = () => {
  const { data, isLoading } = useQuery({
    queryKey: CHAT_KEY,
    queryFn: () => fetchJson('/api/lobby/chat'),
    refetchInterval: 3000,
  })
  return { messages: computed(() => data.value ?? []), isLoading }
}

export const useSendMessage = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (message) => fetchJson('/api/lobby/chat', { method: 'POST', body: JSON.stringify({ message }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAT_KEY }),
  })
}
