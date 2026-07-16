import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getToken } from '../../lib/api'

// Guards a route that requires a logged-in user.
//
// This only checks that a token *exists* — it deliberately does not make a
// network call to "verify" the token before rendering. That keeps the check
// synchronous, so an unauthenticated visitor is redirected to Login before
// any protected page ever mounts (no flash of Dashboard/Notes/Profile).
//
// An *invalid or expired* token can only be discovered by asking the backend
// (this project doesn't decode JWTs on the client, by design — see api.ts).
// That case is handled centrally: the first API call the page makes will
// come back 401, api.ts will clear the token and emit an 'unauthorized'
// event, and AuthEventHandler (mounted once in App.tsx) will redirect. So
// every protected page is covered, either immediately (no token) or on its
// first request (bad token) — without duplicating that logic per page.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const token = getToken()

  if (!token) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return <>{children}</>
}
