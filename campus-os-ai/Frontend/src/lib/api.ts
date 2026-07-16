import { useMemo } from 'react'
import { emitAuthEvent } from './authEvents'

export type ApiError = { error?: string; message?: string }

export type NotificationType = 'task' | 'note' | 'ai' | 'general'

export interface NotificationItem {
  id: number
  type: NotificationType
  title: string
  message: string | null
  read: boolean
  createdAt: string
}

// A request failure that carries the real HTTP status code, so callers can
// branch on `error.status` instead of guessing from `error.message` text.
export class ApiRequestError extends Error {
  status: number
  payload?: ApiError

  constructor(status: number, message: string, payload?: ApiError) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.payload = payload
  }
}

// ─── Token storage ────────────────────────────────────────────────────────────

const TOKEN_KEY = 'campusos_ai_token'

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY)
}

// ─── Base URL / Fetch ─────────────────────────────────────────────────────────
// Vite dev server can proxy /api -> backend, so we call relative /api paths.
// If you set VITE_API_BASE_URL it will be used; otherwise we rely on /api proxy.

const BASE = '/api'

function getApiBaseUrl(): string {
  const v = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined
  const trimmed = typeof v === 'string' ? v.trim() : ''
  return trimmed || BASE
}

async function request<T>(
  path: string,
  opts?: { method?: string; body?: unknown; auth?: boolean }
): Promise<T> {
  const method = opts?.method ?? 'GET'
  const auth = opts?.auth ?? true

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`,
    {
      method,
      headers,
      body: opts?.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: 'include',
    }
  )

  const ct = res.headers.get('content-type') ?? ''
  const data: any = ct.includes('application/json')
    ? await res.json().catch(() => ({}))
    : await res.text().catch(() => ({}))

  if (!res.ok) {
    const payload = data as ApiError
    const message = payload?.error || payload?.message || `Request failed: ${res.status}`

    // Only requests that were actually sent with a token can mean "your
    // session is invalid" — an 401 from an unauthenticated call (e.g. a
    // wrong password on /auth/login) is just a normal form error and must
    // not clear tokens or redirect anyone.
    if (auth && res.status === 401) {
      clearToken()
      emitAuthEvent({ type: 'unauthorized', message })
    } else if (auth && res.status === 403) {
      emitAuthEvent({ type: 'forbidden', message })
    } else if (res.status >= 500) {
      emitAuthEvent({ type: 'server-error', message })
    }

    throw new ApiRequestError(res.status, message, payload)
  }

  return data as T
}

// ─── API surface ──────────────────────────────────────────────────────────────

export interface UserProfileDto {
  id: number
  name: string
  email: string
  branch?: string | null
  year?: string | null
}

export const api = {
  auth: {
    login(body: { email: string; password: string }) {
      return request<{ token: string; user: { id: number; name: string; email: string } }>(
        '/auth/login',
        { method: 'POST', body, auth: false }
      )
    },

    register(body: {
      name: string
      email: string
      password: string
      branch?: string
      year?: string
    }) {
      return request<{ id: number }>('/auth/register', { method: 'POST', body, auth: false })
    },

    registerWithGesture(body: {
      name: string
      email: string
      branch?: string
      year?: string
      sequence: string[]
    }) {
      return request<{ token: string; user: { id: number; name: string; email: string } }>(
        '/auth/register-gesture',
        { method: 'POST', body, auth: false }
      )
    },

    profile() {
      return request<{ user: UserProfileDto }>('/auth/profile', {
        method: 'GET',
        auth: true,
      })
    },

    updateProfile(body: { name?: string; branch?: string; year?: string }) {
      return request<{ user: UserProfileDto }>('/auth/profile', {
        method: 'PATCH',
        body,
      })
    },

    gestureStatus(email: string) {
      return request<{ gestureEnabled: boolean }>(
        `/auth/gesture/status?email=${encodeURIComponent(email)}`,
        { method: 'GET', auth: false }
      )
    },

    gestureLogin(body: { email: string; sequence: string[] }) {
      return request<{ token: string; user: { id: number; name: string; email: string } }>(
        '/auth/gesture/login',
        { method: 'POST', body, auth: false }
      )
    },

    gestureRegister(body: { sequence: string[] }) {
      return request<{ ok: true }>('/auth/gesture/register', { method: 'POST', body })
    },

    gestureDisable() {
      return request<{ ok: true }>('/auth/gesture/register', { method: 'DELETE' })
    },

    /*
    // TODO: Implement forgot password flow
    forgotPassword(body: { email: string }) {
      return request<void>('/auth/forgot-password', {
        method: 'POST',
        body,
        auth: false,
      });
    },

    resetPassword(body: { token: string; password: string }) {
      return request<void>('/auth/reset-password', { method: 'POST', body, auth: false });
    },
    */
  },

  tasks: {
    list() {
      return request<{ tasks: Array<{ id: number; title: string; dueDate: string | null; completed: boolean }> }>(
        '/tasks',
        { method: 'GET' }
      )
    },

    create(body: { title: string; due_date?: string; completed?: boolean }) {
      return request<{ task: { id: number; title: string; dueDate: string | null; completed: boolean } }>(
        '/tasks',
        { method: 'POST', body }
      )
    },

    update(id: number, body: { title?: string; due_date?: string | null; completed?: boolean }) {
      return request<{ task: { id: number; title: string; dueDate: string | null; completed: boolean } }>(
        `/tasks/${id}`,
        { method: 'PUT', body }
      )
    },

    delete(id: number) {
      return request<void>(`/tasks/${id}`, { method: 'DELETE' })
    },
  },

  notes: {
    list() {
      // Backend returns: { notes: [{ id, title, content, updatedAt }] }
      return request<{ notes: Array<{ id: number; title: string; content: string; updatedAt: string | null }> }>(
        '/notes',
        { method: 'GET' }
      )
    },

    get(id: number) {
      // Backend returns: { note: { id, title, content, updatedAt } }
      return request<{ note: { id: number; title: string; content: string; updatedAt: string | null } }>(
        `/notes/${id}`,
        { method: 'GET' }
      )
    },

    create(body: { title: string; content?: string }) {
      return request<{ note: { id: number; title: string; content: string; updatedAt: string | null } }>(
        '/notes',
        { method: 'POST', body }
      )
    },

    update(id: number, body: { title?: string; content?: string }) {
      return request<{ note: { id: number; title: string; content: string; updatedAt: string | null } }>(
        `/notes/${id}`,
        { method: 'PUT', body }
      )
    },

    delete(id: number) {
      return request<void>(`/notes/${id}`, { method: 'DELETE' })
    },
  },

  notifications: {
    list(opts?: { limit?: number; type?: NotificationType; unreadOnly?: boolean }) {
      const params = new URLSearchParams()
      if (opts?.limit) params.set('limit', String(opts.limit))
      if (opts?.type) params.set('type', opts.type)
      if (opts?.unreadOnly) params.set('unread', 'true')
      const qs = params.toString()
      return request<{ notifications: NotificationItem[] }>(
        `/notifications${qs ? `?${qs}` : ''}`,
        { method: 'GET' }
      )
    },

    unreadCount() {
      return request<{ count: number }>('/notifications/unread-count', { method: 'GET' })
    },

    markRead(id: number) {
      return request<{ notification: NotificationItem }>(`/notifications/${id}/read`, { method: 'PATCH' })
    },

    markAllRead() {
      return request<{ updated: number }>('/notifications/read-all', { method: 'PATCH' })
    },

    delete(id: number) {
      return request<void>(`/notifications/${id}`, { method: 'DELETE' })
    },
  },
}

// Some parts of the app may import this hook-like helper.
export function useApi() {
  return useMemo(() => api, [])
}
