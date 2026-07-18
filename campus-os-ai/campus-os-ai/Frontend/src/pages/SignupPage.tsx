import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, setToken } from '../lib/api'
import { useHandLandmarker } from '../hooks/useHandLandmarker'
import AirWritePassword from './components/AirWritePassword'
import {
  GESTURE_LABELS,
  MIN_SEQUENCE_LENGTH,
  MAX_SEQUENCE_LENGTH,
  DEFAULT_SEQUENCE_LENGTH,
  type GestureName,
} from '../lib/gestures'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormFields {
  name: string
  email: string
  branch: string
  year: string
}

type FormErrors = Partial<Record<keyof FormFields, string>>

// ─── Constants ────────────────────────────────────────────────────────────────

const BRANCHES = [
  'Computer Science & Engineering',
  'Information Technology',
  'Electronics & Communication',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'Biotechnology',
  'Other',
]

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year']

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputCls = (hasError: boolean): string =>
  `w-full rounded-xl border bg-white/5 px-4 py-2.5 text-sm text-[#E2E8F0] placeholder-[#3B4558] outline-none transition-colors focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/20 ${
    hasError ? 'border-red-500/60' : 'border-white/10'
  }`

// ─── Icons ────────────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4" aria-hidden="true">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
//
// Signup flow: step 1 collects name/email/branch/year. Step 2 lets the user
// pick how they'll sign in from now on — a gesture sequence (the original
// "AI Hand Authenticator" flow, ported to the webcam) or a password, which
// can itself be typed normally or written in the air with an index-finger
// trajectory recognized by lib/airWriteRecognizer.ts. Whichever method is
// chosen, the account is registered and the user is logged straight into
// the (unchanged) dashboard.

type Step = 'details' | 'method' | 'gesture' | 'password'
type SignupMethod = 'gesture' | 'password'
type PasswordInputMode = 'type' | 'air'

export default function SignupPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('details')

  const [form, setForm] = useState<FormFields>({ name: '', email: '', branch: '', year: '' })
  const [errors, setErrors] = useState<FormErrors>({})

  const setField = (field: keyof FormFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
    }

  const setYear = (year: string) => {
    setForm((prev) => ({ ...prev, year }))
    if (errors.year) setErrors((prev) => ({ ...prev, year: undefined }))
  }

  const validate = (): boolean => {
    const next: FormErrors = {}
    if (!form.name.trim()) next.name = 'Full name is required.'
    if (!form.email) {
      next.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = 'Enter a valid email address.'
    }
    if (!form.branch) next.branch = 'Please select your branch.'
    if (!form.year) next.year = 'Please select your year.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function continueToMethod(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    if (!validate()) return
    setStep('method')
  }

  // ── Sign-in method choice ─────────────────────────────────────────────────

  function chooseMethod(m: SignupMethod) {
    setStep(m === 'gesture' ? 'gesture' : 'password')
  }

  // ── Password capture (typed or written in air) ────────────────────────────

  const [passwordMode, setPasswordMode] = useState<PasswordInputMode>('type')
  const [typedPassword, setTypedPassword] = useState('')
  const [typedConfirm, setTypedConfirm] = useState('')
  const [passwordFormError, setPasswordFormError] = useState<string | null>(null)
  const [passwordLoading, setPasswordLoading] = useState(false)

  async function registerWithPassword(password: string) {
    setPasswordFormError(null)
    setPasswordLoading(true)
    try {
      await api.auth.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password,
        branch: form.branch,
        year: form.year,
      })
      const result = await api.auth.login({ email: form.email.trim(), password })
      setToken(result.token)
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      setPasswordFormError(String(err?.message ?? err))
      setPasswordLoading(false)
    }
  }

  function submitTypedPassword(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    if (typedPassword.length < 8) {
      setPasswordFormError('Password must be at least 8 characters.')
      return
    }
    if (typedPassword !== typedConfirm) {
      setPasswordFormError("Passwords don't match.")
      return
    }
    registerWithPassword(typedPassword)
  }

  // ── Gesture capture (step 2) ──────────────────────────────────────────────

  const [sequence, setSequence] = useState<GestureName[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { videoRef, status, errorMessage, liveGesture, holdProgress, onConfirm, resetHold } =
    useHandLandmarker(step === 'gesture')

  useEffect(() => {
    onConfirm((gesture) => {
      setSequence((prev) => (prev.length >= MAX_SEQUENCE_LENGTH ? prev : [...prev, gesture]))
      resetHold()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onConfirm, resetHold])

  function undoLast() {
    setSequence((prev) => prev.slice(0, -1))
  }

  function startOver() {
    setSequence([])
    setFormError(null)
  }

  async function createAccount() {
    setFormError(null)
    setLoading(true)
    try {
      const result = await api.auth.registerWithGesture({
        name: form.name.trim(),
        email: form.email.trim(),
        branch: form.branch,
        year: form.year,
        sequence,
      })
      setToken(result.token)
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      setFormError(String(err?.message ?? err))
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4 py-12 pb-[env(safe-area-inset-bottom)] overflow-hidden">

      {/* Ambient orb */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-140px] left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(108,99,255,0.16) 0%, rgba(139,92,246,0.07) 45%, transparent 70%)',
          filter: 'blur(36px)',
        }}
      />

      <div className="relative w-full max-w-sm">

        {/* Brand */}
        <div className="mb-8 text-center">
          <span
            className="inline-block text-2xl font-bold text-white"
            style={{ letterSpacing: '-0.03em' }}
          >
            Campus<span className="text-[#6C63FF]">OS</span>
          </span>
          <p className="mt-1 text-sm text-[#64748B]">
            {step === 'details' && 'Create your account'}
            {step === 'method' && 'Choose how you\'ll sign in'}
            {step === 'gesture' && 'Set your gesture sign-in'}
            {step === 'password' && 'Set your password'}
          </p>
        </div>

        {step === 'details' && (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] px-6 py-8 shadow-2xl">

            {/* Google button */}
            <button
              type="button"
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-[#E2E8F0] transition-colors hover:bg-white/10 active:scale-[0.98]"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <hr className="flex-1 border-white/10" />
              <span className="text-xs text-[#64748B]">or</span>
              <hr className="flex-1 border-white/10" />
            </div>

            {/* Full Name */}
            <div className="mb-4">
              <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-[#94A3B8]">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="Your Name"
                value={form.name}
                onChange={setField('name')}
                className={inputCls(!!errors.name)}
              />
              {errors.name && <p className="mt-1.5 text-xs text-red-400">{errors.name}</p>}
            </div>

            {/* Email */}
            <div className="mb-4">
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-[#94A3B8]">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={setField('email')}
                className={inputCls(!!errors.email)}
              />
              {errors.email && <p className="mt-1.5 text-xs text-red-400">{errors.email}</p>}
            </div>

            {/* Branch */}
            <div className="mb-4">
              <label htmlFor="branch" className="mb-1.5 block text-xs font-medium text-[#94A3B8]">
                Branch
              </label>
              <div className="relative">
                <select
                  id="branch"
                  value={form.branch}
                  onChange={setField('branch')}
                  className={
                    inputCls(!!errors.branch) +
                    ' appearance-none pr-9 cursor-pointer' +
                    (!form.branch ? ' text-[#3B4558]' : '')
                  }
                >
                  <option value="" disabled hidden>
                    Select your branch
                  </option>
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">
                  <ChevronDownIcon />
                </span>
              </div>
              {errors.branch && <p className="mt-1.5 text-xs text-red-400">{errors.branch}</p>}
            </div>

            {/* Year */}
            <div className="mb-6">
              <label className="mb-1.5 block text-xs font-medium text-[#94A3B8]">Year</label>
              <div className="flex gap-2">
                {YEARS.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setYear(y)}
                    className={`flex-1 rounded-xl border py-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] ${
                      form.year === y
                        ? 'border-[#6C63FF] bg-[#6C63FF]/15 text-[#A5A0FF]'
                        : 'border-white/10 bg-white/5 text-[#64748B] hover:border-white/20 hover:text-[#94A3B8]'
                    }`}
                  >
                    {y.replace(' Year', '')}
                  </button>
                ))}
              </div>
              {errors.year && <p className="mt-1.5 text-xs text-red-400">{errors.year}</p>}
            </div>

            {/* Continue */}
            <button
              type="submit"
              onClick={continueToMethod}
              className="w-full rounded-xl bg-[#6C63FF] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#6C63FF]/20 transition-all hover:bg-[#7C6FFF] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111118]"
            >
              Continue
            </button>
          </div>
        )}

        {step === 'method' && (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] px-6 py-8 shadow-2xl">
            <p className="mb-5 text-center text-xs text-[#94A3B8]">
              Pick how you'd like to sign in to CampusOS from now on.
            </p>

            <button
              type="button"
              onClick={() => chooseMethod('gesture')}
              className="mb-3 flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-left transition-colors hover:bg-white/10 active:scale-[0.98]"
            >
              <span className="text-2xl">✋</span>
              <span>
                <span className="block text-sm font-semibold text-[#E2E8F0]">Gesture sign-in</span>
                <span className="block text-xs text-[#64748B]">Sign in with a sequence of hand gestures</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => chooseMethod('password')}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-left transition-colors hover:bg-white/10 active:scale-[0.98]"
            >
              <span className="text-2xl">🔐</span>
              <span>
                <span className="block text-sm font-semibold text-[#E2E8F0]">Password</span>
                <span className="block text-xs text-[#64748B]">Type it, or write it in the air with your finger</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStep('details')}
              className="mt-5 w-full text-xs font-semibold text-[#64748B]"
            >
              ← Back to details
            </button>
          </div>
        )}

        {step === 'password' && (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] px-6 py-8 shadow-2xl">
            {/* Type / Write in Air toggle */}
            <div className="mb-5 flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
              <button
                type="button"
                onClick={() => {
                  setPasswordMode('type')
                  setPasswordFormError(null)
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                  passwordMode === 'type' ? 'bg-[#6C63FF] text-white' : 'text-[#94A3B8]'
                }`}
              >
                ⌨️ Type
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasswordMode('air')
                  setPasswordFormError(null)
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                  passwordMode === 'air' ? 'bg-[#6C63FF] text-white' : 'text-[#94A3B8]'
                }`}
              >
                ✍️ Write in Air
              </button>
            </div>

            {passwordMode === 'type' && (
              <>
                <div className="mb-4">
                  <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-[#94A3B8]">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={typedPassword}
                    onChange={(e) => {
                      setTypedPassword(e.target.value)
                      setPasswordFormError(null)
                    }}
                    className={inputCls(false)}
                  />
                </div>
                <div className="mb-5">
                  <label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-medium text-[#94A3B8]">
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    value={typedConfirm}
                    onChange={(e) => {
                      setTypedConfirm(e.target.value)
                      setPasswordFormError(null)
                    }}
                    className={inputCls(false)}
                  />
                </div>

                {passwordFormError && (
                  <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                    <p className="text-xs text-red-300 font-medium">{passwordFormError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={submitTypedPassword}
                  disabled={passwordLoading}
                  className="w-full rounded-xl bg-[#6C63FF] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#6C63FF]/20 transition-all hover:bg-[#7C6FFF] active:scale-[0.98] disabled:opacity-60"
                >
                  {passwordLoading ? 'Creating account…' : 'Create account'}
                </button>
              </>
            )}

            {passwordMode === 'air' && (
              <>
                {passwordFormError && (
                  <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                    <p className="text-xs text-red-300 font-medium">{passwordFormError}</p>
                  </div>
                )}
                <AirWritePassword
                  purpose="create"
                  onComplete={registerWithPassword}
                  onCancel={() => setPasswordMode('type')}
                />
              </>
            )}

            <button
              type="button"
              onClick={() => setStep('method')}
              className="mt-3 w-full text-xs font-semibold text-[#64748B]"
            >
              ← Back
            </button>
          </div>
        )}

        {step === 'gesture' && (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] px-6 py-8 shadow-2xl">
            <p className="mb-4 text-center text-xs text-[#94A3B8]">
              Perform {DEFAULT_SEQUENCE_LENGTH} or more gestures ({MIN_SEQUENCE_LENGTH}–{MAX_SEQUENCE_LENGTH}), holding
              each one steady — this sequence becomes your sign-in from now on.
            </p>

            <div className="relative mx-auto mb-4 w-full max-w-[260px] aspect-[4/3] rounded-2xl overflow-hidden border border-white/[0.08] bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
              {status === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-[#94A3B8] bg-black/60">
                  Starting camera…
                </div>
              )}
              {(status === 'denied' || status === 'error') && (
                <div className="absolute inset-0 flex items-center justify-center text-center px-4 text-xs text-red-300 bg-black/70">
                  {errorMessage ?? 'Camera unavailable.'}
                </div>
              )}
              {status === 'ready' && liveGesture && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white flex items-center gap-2">
                  <span>{GESTURE_LABELS[liveGesture].emoji} {GESTURE_LABELS[liveGesture].label}</span>
                  <span className="inline-block h-1.5 w-10 rounded-full bg-white/20 overflow-hidden">
                    <span className="block h-full bg-[#6C63FF] transition-[width]" style={{ width: `${Math.round(holdProgress * 100)}%` }} />
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 mb-5 flex-wrap min-h-[36px]">
              {sequence.length === 0 && <span className="text-xs text-[#3B4558]">No gestures captured yet</span>}
              {sequence.map((g, i) => (
                <span key={`${g}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-[#6C63FF]/30 bg-[#6C63FF]/10 px-3 py-1.5 text-xs font-semibold text-[#C7C4FF]">
                  {i + 1}. {GESTURE_LABELS[g].emoji} {GESTURE_LABELS[g].label}
                </span>
              ))}
            </div>

            {formError && (
              <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                <p className="text-xs text-red-300 font-medium">{formError}</p>
              </div>
            )}

            <div className="flex gap-2 mb-3">
              <button type="button" onClick={undoLast} disabled={sequence.length === 0}
                className="flex-1 rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-[#E2E8F0] disabled:opacity-40">
                Undo last
              </button>
              <button type="button" onClick={startOver} disabled={sequence.length === 0}
                className="flex-1 rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-[#E2E8F0] disabled:opacity-40">
                Start over
              </button>
            </div>

            <button
              type="button"
              onClick={createAccount}
              disabled={sequence.length < MIN_SEQUENCE_LENGTH || loading}
              className="w-full rounded-xl bg-[#6C63FF] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#6C63FF]/20 transition-all hover:bg-[#7C6FFF] active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>

            <button
              type="button"
              onClick={() => setStep('details')}
              className="mt-3 w-full text-xs font-semibold text-[#64748B]"
            >
              ← Back to details
            </button>
          </div>
        )}

        {/* Login link */}
        <p className="mt-6 text-center text-sm text-[#64748B]">
          Already have an account?{' '}
          <Link to="/" className="font-medium text-[#6C63FF] hover:text-[#8B5CF6] transition-colors">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
