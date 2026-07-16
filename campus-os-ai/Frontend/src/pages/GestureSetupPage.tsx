import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useHandLandmarker } from "../hooks/useHandLandmarker";
import {
  GESTURE_LABELS,
  DEFAULT_SEQUENCE_LENGTH,
  MIN_SEQUENCE_LENGTH,
  MAX_SEQUENCE_LENGTH,
  type GestureName,
} from "../lib/gestures";

// Lets a signed-in user record the gesture sequence that will unlock
// CampusOS next time, instead of typing a password — the setup counterpart
// to LoginPage.tsx's capture flow. Reachable right after signup, or later
// from Profile.

export default function GestureSetupPage() {
  const navigate = useNavigate();
  const [sequence, setSequence] = useState<GestureName[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { videoRef, status, errorMessage, liveGesture, holdProgress, onConfirm, resetHold } =
    useHandLandmarker(true);

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

  function undoLast() {
    setSequence((prev) => prev.slice(0, -1));
  }

  function startOver() {
    setSequence([]);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.auth.gestureRegister({ sequence });
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't save your gesture sequence.");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center px-5 text-center">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-white mb-2">Gesture sign-in is set up</h1>
        <p className="text-sm text-[#64748B] mb-6">
          Next time, sign in by performing this sequence in front of your camera.
        </p>
        <button
          type="button"
          onClick={() => navigate("/dashboard", { replace: true })}
          className="rounded-2xl bg-[#6C63FF] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#6C63FF]/25"
        >
          Go to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0A0A0F] flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="relative flex-1 flex flex-col justify-center px-5 py-10">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-white mb-1">Set up gesture sign-in</h1>
          <p className="text-sm text-[#64748B]">
            Choose {DEFAULT_SEQUENCE_LENGTH} or more gestures ({MIN_SEQUENCE_LENGTH}–{MAX_SEQUENCE_LENGTH}) — you'll repeat this exact sequence to log in.
          </p>
        </div>

        <div className="rounded-3xl border border-white/[0.07] bg-[#111118] px-5 py-7 shadow-2xl">
          <div className="relative mx-auto mb-4 w-full max-w-[280px] aspect-[4/3] rounded-2xl overflow-hidden border border-white/[0.08] bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
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

          {error && (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
              <p className="text-xs text-red-300 font-medium">{error}</p>
            </div>
          )}

          <div className="flex gap-2 mb-3">
            <button type="button" onClick={undoLast} disabled={sequence.length === 0}
              className="flex-1 rounded-2xl border border-white/[0.09] bg-white/[0.04] px-4 py-3 text-xs font-semibold text-[#E2E8F0] disabled:opacity-40">
              Undo last
            </button>
            <button type="button" onClick={startOver} disabled={sequence.length === 0}
              className="flex-1 rounded-2xl border border-white/[0.09] bg-white/[0.04] px-4 py-3 text-xs font-semibold text-[#E2E8F0] disabled:opacity-40">
              Start over
            </button>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={sequence.length < MIN_SEQUENCE_LENGTH || saving}
            className="w-full rounded-2xl bg-[#6C63FF] px-4 py-4 text-sm font-bold text-white shadow-lg shadow-[#6C63FF]/25 transition-all active:scale-95 disabled:opacity-60"
            style={{ minHeight: "52px" }}
          >
            {saving ? "Saving…" : "Save gesture sequence"}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-[#64748B]">
          <Link to="/dashboard" className="font-bold text-[#6C63FF]">Skip for now</Link>
        </p>
      </div>
    </div>
  );
}
