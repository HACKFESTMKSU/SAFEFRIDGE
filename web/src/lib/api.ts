const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:8000/api'

const TOKEN_KEY = 'coldguard.token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface ApiOptions {
  method?: string
  body?: unknown
}

function formatDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const parts = detail.map((item) => {
      if (item && typeof item === 'object' && 'msg' in item) {
        return String((item as { msg: unknown }).msg)
      }
      return typeof item === 'string' ? item : JSON.stringify(item)
    })
    return parts.filter(Boolean).join('; ') || 'Request failed'
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail)
  return String(detail)
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 401) setToken(null)

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = (await res.json()) as { detail?: unknown }
      if (data?.detail !== undefined) message = formatDetail(data.detail)
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** Multipart upload (video characterize). Do not set Content-Type — browser sets boundary. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: form,
  })

  if (res.status === 401) setToken(null)

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = (await res.json()) as { detail?: unknown }
      if (data?.detail !== undefined) message = formatDetail(data.detail)
    } catch {
      // non-JSON
    }
    throw new ApiError(res.status, message)
  }

  return (await res.json()) as T
}
