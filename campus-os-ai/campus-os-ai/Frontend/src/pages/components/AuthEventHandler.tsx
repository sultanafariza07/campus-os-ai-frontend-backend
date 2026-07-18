import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { subscribeAuthEvent, type AuthEvent } from '../../lib/authEvents'

type Toast = { kind: 'forbidden' | 'server-error'; message: string }

// Mounted once, inside <BrowserRouter> (see App.tsx). This is the single
// place that reacts to api.ts's auth/error events, so no individual page
// needs to duplicate "if the request failed because of auth, log out and
// redirect" logic.
//
//   401 (unauthorized) -> token was already cleared by api.ts; redirect to Login
//   403 (forbidden)     -> show a "you don't have permission" toast
//   5xx (server error)  -> show a generic error toast
export default function AuthEventHandler() {
  const navigate = useNavigate()
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeAuthEvent((event: AuthEvent) => {
      if (event.type === 'unauthorized') {
        navigate('/', { replace: true })
        return
      }

      if (event.type === 'forbidden') {
        setToast({ kind: 'forbidden', message: event.message || "You don't have permission to do that." })
        return
      }

      setToast({ kind: 'server-error', message: event.message || 'Something went wrong. Please try again.' })
    })

    return unsubscribe
  }, [navigate])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  if (!toast) return null

  return (
    <div className="fixed bottom-24 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 shadow-2xl backdrop-blur-sm">
      <p className="text-xs font-semibold text-red-200">
        {toast.kind === 'forbidden' ? 'Access denied' : 'Server error'}
      </p>
      <p className="mt-0.5 text-xs text-red-200/80">{toast.message}</p>
    </div>
  )
}
