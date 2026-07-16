// Centralized auth/error event bus.
//
// Why this exists: api.ts (a plain module, not a React component) is the one
// place that knows the real HTTP status of every request. Rather than every
// page re-deriving "was this an auth failure?" from an error *message*
// (fragile string matching like `.includes('token')`), api.ts emits a typed
// event here based on the actual status code, and a single component
// (AuthEventHandler, mounted once in App.tsx) reacts to it — redirecting to
// login on 401, and surfacing a toast for 403/500. No page needs to know
// about any of this.

export type AuthEvent =
  | { type: 'unauthorized'; message: string }
  | { type: 'forbidden'; message: string }
  | { type: 'server-error'; message: string }

type AuthEventListener = (event: AuthEvent) => void

const listeners = new Set<AuthEventListener>()

export function subscribeAuthEvent(listener: AuthEventListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitAuthEvent(event: AuthEvent): void {
  listeners.forEach((listener) => listener(event))
}
