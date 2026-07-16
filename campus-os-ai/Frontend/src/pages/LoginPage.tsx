import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, getToken, setToken } from "../lib/api";
import { useHandLandmarker } from "../hooks/useHandLandmarker";
import {
  GESTURE_LABELS,
  MIN_SEQUENCE_LENGTH,
  MAX_SEQUENCE_LENGTH,
  type GestureName,
} from "../lib/gestures";

// ─── Component ────────────────────────────────────────────────────────────────
//
// This is CampusOS's gesture sign-in flow — the login page ported over from
// the "AI Hand Authenticator" project: instead of typing a password, the
// user performs a short sequence of hand gestures in front of the webcam
// (each one held steady for a moment to confirm it, same idea as that
// project's liveness-checked gesture capture). A password sign-in remains
// available as a fallback at /login/password.

type Stage = "email" | "no-gesture" | "capturing" | "submitting";

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("email");
  const [sequence, setSequence] = useState<GestureName[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const capturing = stage === "capturing";
  const { videoRef, status, errorMessage, liveGesture, holdProgress, onConfirm, resetHold } =
    useHandLandmarker(capturing);

  useEffect(() => {
    if (getToken()) navigate("/dashboard", { replace: true });
  }, [navigate]);

  useEffect(() => {
    onConfirm((gesture) => {
      setSequence((prev) => {
        if (prev.length >= MAX_SEQUENCE_LENGTH) return prev;
        return [...prev, gesture];
      });
      resetHold();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onConfirm, resetHold]);

  async function handleContinue() {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(null);
    setChecking(true);
    setFormError(null);
    try {
      const { gestureEnabled } = await api.auth.gestureStatus(trimmed);
      if (gestureEnabled) {
        setSequence([]);
        setStage("capturing");
      } else {
        setStage("no-gesture");
      }
    } catch {
      setFormError("Couldn't reach the server. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  function undoLast() {
    setSequence((prev) => prev.slice(0, -1));
  }

  function startOver() {
    setSequence([]);
    setFormError(null);
  }

  async function submitSequence() {
    setStage("submitting");
    setFormError(null);
    try {
      const result = await api.auth.gestureLogin({ email: email.trim(), sequence });
      setToken(result.token);
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gesture sign-in failed.";
      setFormError(message);
      setSequence([]);
      setStage("capturing");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen bg-[#0A0A0F] flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div aria-hidden="true" className="pointer-events-none fixed top-0 left-0 right-0 h-64 z-0"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(108,99,255,0.22) 0%, transparent 70%)" }} />

      <div className="relative flex-1 flex flex-col justify-center px-5 py-10 z-10">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#6C63FF]/15 border border-[#6C63FF]/25 mb-4">
            <span className="text-2xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: "-0.03em" }}>
            Campus<span className="text-[#6C63FF]">OS</span>
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">Sign in with your hand gestures</p>
        </div>

        <div className="rounded-3xl border border-white/[0.07] bg-[#111118] px-5 py-7 shadow-2xl">
          {stage === "email" && (
            <>
              <label htmlFor="email" className="mb-2 block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@college.edu"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleContinue()}
                className={[
                  "w-full rounded-2xl border bg-white/[0.04] px-4 py-3.5",
                  "text-[#E2E8F0] placeholder-[#2D3748] outline-none transition-all",
                  "focus:border-[#6C63FF] focus:ring-1 focus:ring-[#6C63FF]/30",
                  emailError ? "border-red-500/60" : "border-white/[0.08]",
                ].join(" ")}
                style={{ minHeight: "52px", fontSize: "16px" }}
              />
              {emailError && <p className="mt-2 text-xs text-red-400 font-medium">{emailError}</p>}
              {formError && <p className="mt-3 text-xs text-red-300 font-medium">{formError}</p>}

              <button
                type="button"
                onClick={handleContinue}
                disabled={checking}
                className="mt-5 w-full rounded-2xl bg-[#6C63FF] px-4 py-4 text-sm font-bold text-white shadow-lg shadow-[#6C63FF]/25 transition-all active:scale-95 disabled:opacity-60"
                style={{ minHeight: "52px" }}
              >
                {checking ? "Checking…" : "Continue"}
              </button>
            </>
          )}

          {stage === "no-gesture" && (
            <div className="text-center py-2">
              <p className="text-sm text-[#94A3B8] mb-5">
                This account doesn't have gesture sign-in set up yet.
              </p>
              <Link
                to={`/login/password?email=${encodeURIComponent(email.trim())}`}
                className="block w-full rounded-2xl bg-[#6C63FF] px-4 py-4 text-sm font-bold text-white text-center shadow-lg shadow-[#6C63FF]/25 active:scale-95"
                style={{ minHeight: "52px", lineHeight: "28px" }}
              >
                Sign in with password instead
              </Link>
              <button
                type="button"
                onClick={() => setStage("email")}
                className="mt-3 text-xs font-semibold text-[#64748B]"
              >
                ← Use a different email
              </button>
            </div>
          )}

          {(stage === "capturing" || stage === "submitting") && (
            <div>
              <div className="relative mx-auto mb-4 w-full max-w-[280px] aspect-[4/3] rounded-2xl overflow-hidden border border-white/[0.08] bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
                {status === "loading" && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-[#94A3B8] bg-black/60">
                    Starting camera…
                  </div>
                )}
                {(status === "denied" || status === "error") && (
                  <div className="absolute inset-0 flex items-center justify-center text-center px-4 text-xs text-red-300 bg-black/70">
                    {errorMessage ?? "Camera unavailable."}
                  </div>
                )}
                {status === "ready" && liveGesture && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white flex items-center gap-2">
                    <span>{GESTURE_LABELS[liveGesture].emoji} {GESTURE_LABELS[liveGesture].label}</span>
                    <span
                      className="inline-block h-1.5 w-10 rounded-full bg-white/20 overflow-hidden"
                      aria-hidden="true"
                    >
                      <span
                        className="block h-full bg-[#6C63FF] transition-[width]"
                        style={{ width: `${Math.round(holdProgress * 100)}%` }}
                      />
                    </span>
                  </div>
                )}
              </div>

              <p className="text-center text-xs text-[#64748B] mb-3">
                Hold each gesture steady for a moment to add it to your sequence.
              </p>

              <div className="flex items-center justify-center gap-2 mb-5 flex-wrap">
                {sequence.length === 0 && (
                  <span className="text-xs text-[#3B4558]">No gestures captured yet</span>
                )}
                {sequence.map((g, i) => (
                  <span
                    key={`${g}-${i}`}
                    className="inline-flex items-center gap-1 rounded-full border border-[#6C63FF]/30 bg-[#6C63FF]/10 px-3 py-1.5 text-xs font-semibold text-[#C7C4FF]"
                  >
                    {GESTURE_LABELS[g].emoji} {GESTURE_LABELS[g].label}
                  </span>
                ))}
              </div>

              {formError && (
                <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                  <p className="text-xs text-red-300 font-medium">{formError}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={undoLast}
                  disabled={sequence.length === 0 || stage === "submitting"}
                  className="flex-1 rounded-2xl border border-white/[0.09] bg-white/[0.04] px-4 py-3 text-xs font-semibold text-[#E2E8F0] disabled:opacity-40"
                >
                  Undo last
                </button>
                <button
                  type="button"
                  onClick={startOver}
                  disabled={sequence.length === 0 || stage === "submitting"}
                  className="flex-1 rounded-2xl border border-white/[0.09] bg-white/[0.04] px-4 py-3 text-xs font-semibold text-[#E2E8F0] disabled:opacity-40"
                >
                  Start over
                </button>
              </div>

              <button
                type="button"
                onClick={submitSequence}
                disabled={sequence.length < MIN_SEQUENCE_LENGTH || stage === "submitting"}
                className="mt-3 w-full rounded-2xl bg-[#6C63FF] px-4 py-4 text-sm font-bold text-white shadow-lg shadow-[#6C63FF]/25 transition-all active:scale-95 disabled:opacity-60"
                style={{ minHeight: "52px" }}
              >
                {stage === "submitting" ? "Signing in…" : `Sign in (${sequence.length} gesture${sequence.length === 1 ? "" : "s"})`}
              </button>

              <button
                type="button"
                onClick={() => setStage("email")}
                className="mt-3 w-full text-xs font-semibold text-[#64748B]"
              >
                ← Use a different email
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-[#64748B]">
          <Link to="/login/password" className="font-bold text-[#6C63FF]">Sign in with password instead</Link>
        </p>
        <p className="mt-3 text-center text-sm text-[#64748B]">
          Don't have an account?{" "}
          <Link to="/signup" className="font-bold text-[#6C63FF]">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
