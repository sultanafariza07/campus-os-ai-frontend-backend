import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { api, setToken } from '../../lib/api'

interface GoogleAuthButtonProps {
  onSuccess?: () => void
  onError?: (message: string) => void
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export function GoogleAuthButton({ onSuccess, onError }: GoogleAuthButtonProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      setLoading(true)
      try {
        const result = await api.auth.google({ id_token: credentialResponse.credential })
        setToken(result.token)
        onSuccess?.()
        navigate('/dashboard', { replace: true })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Google sign-in failed. Please try again.'
        onError?.(message)
      } finally {
        setLoading(false)
      }
    } else {
      onError?.('Google credential not found in response.')
    }
  }

  if (loading) {
    return (
      <div className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.04] px-4 py-3.5 text-sm font-semibold text-[#E2E8F0] opacity-60" style={{ minHeight: '52px' }}>
        <GoogleIcon /> Signing in...
      </div>
    )
  }

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={() => onError?.('Google sign-in failed. Please try again.')}
      type="standard"
      theme="filled_black"
      size="large"
      text="continue_with"
      shape="rectangular"
      width="100%"
      logo_alignment="left"
    />
  )
}