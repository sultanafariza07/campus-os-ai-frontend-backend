import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, clearToken, getToken, setToken } from "../lib/api";
import AirWritePassword from "./components/AirWritePassword";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormFields {
  email: string;
  password: string;
}

type FormErrors = Partial<Record<keyof FormFields, string>>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the Tailwind class string for a form input, varying only the border colour on error. */
function inputCls(hasError: boolean): string {
  return [
    "w-full rounded-2xl border bg-white/[0.04] px-4 py-3.5",
    "text-[#E2E8F0] placeholder-[#2D3748] outline-none transition-all",
    "focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF]/30",
    hasError ? "border-red-500/60" : "border-white/[0.08]",
  ].join(" ");
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

// ─── Component ────────────────────────────────────────────────────────────────

function useQueryEmail(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("email") ?? "";
}

export default function PasswordLoginPage() {
  const navigate = useNavigate();

  const [email, setEmail]               = useState(useQueryEmail);
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors]             = useState<FormErrors>({});
  const [formError, setFormError]       = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);

  // "type" shows the normal password input below; "air" swaps it out for
  // the webcam air-writing capture, which produces the same plain-text
  // password string once the user's index-finger trajectory is recognized.
  const [entryMode, setEntryMode] = useState<"type" | "air">("type");

  // Ref-based guard prevents duplicate submissions that sneak past the
  // disabled button before the first re-render (e.g. fast double-tap on mobile).
  const submittingRef = useRef(false);

  // If a token is already stored, the user is already logged in.
  // Redirect them away from the login page immediately.
  useEffect(() => {
    if (getToken()) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(trimmedEmail: string, passwordToCheck: string): FormErrors {
    const next: FormErrors = {};

    if (!trimmedEmail) {
      next.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      next.email = "Enter a valid email address.";
    }

    if (!passwordToCheck) {
      next.password = "Password is required.";
    } else if (passwordToCheck.length < 8) {
      next.password = "Password must be at least 8 characters.";
    }

    return next;
  }

  // ── Submit handler ──────────────────────────────────────────────────────────

  async function handleLogin(passwordOverride?: string) {
    // Synchronous guard — blocks re-entry before the first render cycle.
    if (submittingRef.current) return;

    const trimmedEmail = email.trim();
    const passwordToUse = passwordOverride ?? password;

    const fieldErrors = validate(trimmedEmail, passwordToUse);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    submittingRef.current = true;
    setFormError(null);
    setLoading(true);

    // Clear any stale token before attempting a new login.
    clearToken();

    try {
      const result = await api.auth.login({ email: trimmedEmail, password: passwordToUse });
      setToken(result.token);
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      // api.ts always throws `new Error(message)`, so this is safe to narrow.
      const message =
        err instanceof Error
          ? err.message
          : "Login failed. Please try again.";
      setFormError(message);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  // ── Enter-key support ───────────────────────────────────────────────────────

  function handlePasswordKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleLogin();
  }

  // ── Field change helpers ─────────────────────────────────────────────────────

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value);
    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen bg-[#0A0A0F] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div aria-hidden="true" className="pointer-events-none fixed top-0 left-0 right-0 h-64 z-0"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(108,99,255,0.22) 0%, transparent 70%)" }} />

      <div className="relative flex-1 flex flex-col justify-center px-5 py-10 z-10">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#6C63FF]/15 border border-[#6C63FF]/25 mb-4">
            <span className="text-2xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: "-0.03em" }}>
            Campus<span className="text-[#6C63FF]">OS</span>
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">Your AI campus companion</p>
        </div>

        <div className="rounded-3xl border border-white/[0.07] bg-[#111118] px-5 py-7 shadow-2xl">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.04] px-4 py-3.5 text-sm font-semibold text-[#E2E8F0] transition-all active:scale-95"
            style={{ minHeight: '52px' }}
          >
            <GoogleIcon /> Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <hr className="flex-1 border-white/[0.08]" />
            <span className="text-xs text-[#3B4558] font-medium">or sign in with email</span>
            <hr className="flex-1 border-white/[0.08]" />
          </div>

          {/* Email */}
          <div className="mb-4">
            <label htmlFor="email" className="mb-2 block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@college.edu"
              value={email}
              onChange={handleEmailChange}
              className={inputCls(!!errors.email)}
              style={{ minHeight: '52px', fontSize: '16px' }}
            />
            {errors.email && (
              <p className="mt-2 text-xs text-red-400 font-medium">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="mb-2">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="password" className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                Password
              </label>
              <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode("type");
                    setFormError(null);
                  }}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    entryMode === "type" ? "bg-[#6C63FF] text-white" : "text-[#64748B]"
                  }`}
                >
                  ⌨️ Type
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode("air");
                    setFormError(null);
                  }}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    entryMode === "air" ? "bg-[#6C63FF] text-white" : "text-[#64748B]"
                  }`}
                >
                  ✍️ Write in Air
                </button>
              </div>
            </div>

            {entryMode === "type" && (
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={handlePasswordChange}
                  onKeyDown={handlePasswordKeyDown}
                  className={`${inputCls(!!errors.password)} pr-12`}
                  style={{ minHeight: '52px', fontSize: '16px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#4B5563]"
                  style={{ minHeight: 'unset', minWidth: 'unset' }}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            )}
            {errors.password && entryMode === "type" && (
              <p className="mt-2 text-xs text-red-400 font-medium">{errors.password}</p>
            )}
          </div>

          {/* Backend / network error banner (shared by both entry modes) */}
          {formError && (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
              <p className="text-xs text-red-300 font-medium">{formError}</p>
            </div>
          )}

          {entryMode === "type" && (
            <button
              type="button"
              onClick={() => handleLogin()}
              disabled={loading}
              className="w-full rounded-2xl bg-[#6C63FF] px-4 py-4 text-sm font-bold text-white shadow-lg shadow-[#6C63FF]/25 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ minHeight: '52px' }}
            >
              {loading ? "Logging in…" : "Log in"}
            </button>
          )}

          {entryMode === "air" && (
            <AirWritePassword
              purpose="enter"
              onComplete={(pw) => handleLogin(pw)}
              onCancel={() => setEntryMode("type")}
            />
          )}
        </div>

        <p className="mt-4 text-center text-sm text-[#64748B]">
          <Link to="/" className="font-bold text-[#6C63FF]">✋ Sign in with gestures instead</Link>
        </p>

        <p className="mt-6 text-center text-sm text-[#64748B]">
          Don't have an account?{" "}
          <Link to="/signup" className="font-bold text-[#6C63FF]">Sign up</Link>
        </p>
      </div>
    </div>
  );
                }
