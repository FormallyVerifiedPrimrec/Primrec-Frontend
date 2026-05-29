import { supabase } from '../supabaseClient'
import type { Challenge, User } from '../features/challenges/types'

const API_BASE_URL = ((import.meta.env.VITE_CHALLENGES_API_URL as string | undefined) ?? '').replace(/\/+$/, '')

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken()
  const requestPath = API_BASE_URL && !path.startsWith(`${API_BASE_URL}/`) && path !== API_BASE_URL
    ? `${API_BASE_URL}${path}`
    : path

  const res = await fetch(requestPath, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  })

  if (res.status === 204) {
    return undefined as T
  }

  const text = await res.text()
  const data = text ? JSON.parse(text) : undefined

  if (!res.ok) {
    const message = data?.error ?? res.statusText
    throw new Error(message)
  }

  return data as T
}

export async function getChallenges(params: { sort: 'votes' | 'date'; query?: string; limit?: number; offset?: number }): Promise<Challenge[]> {
  const qs = new URLSearchParams({ sort: params.sort })
  if (params.query) qs.set('query', params.query)
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.offset != null) qs.set('offset', String(params.offset))
  return apiFetch<Challenge[]>(`/api/challenges?${qs.toString()}`)
}

export async function getChallengeById(id: string): Promise<Challenge> {
  return apiFetch<Challenge>(`/api/challenges/${encodeURIComponent(id)}`)
}

export async function createChallenge(payload: {
  title: string
  description: string
  templateFunc: string
  postcondition: string
  suggestedSolution?: string
}): Promise<Challenge> {
  return apiFetch<Challenge>(`/api/challenges`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function voteChallenge(id: string, voteType: -1 | 0 | 1): Promise<void> {
  await apiFetch<void>(`/api/challenges/${encodeURIComponent(id)}/vote`, {
    method: 'POST',
    body: JSON.stringify({ voteType }),
  })
}

export async function saveSubmission(id: string, payload: { success: boolean; source?: string }): Promise<void> {
  await apiFetch<void>(`/api/challenges/${encodeURIComponent(id)}/submission`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getLeaderboard(params?: { limit?: number; offset?: number }): Promise<User[]> {
  const qs = new URLSearchParams()
  if (params?.limit != null) qs.set('limit', String(params.limit))
  if (params?.offset != null) qs.set('offset', String(params.offset))
  return apiFetch<User[]>(`/api/leaderboard?${qs.toString()}`)
}
