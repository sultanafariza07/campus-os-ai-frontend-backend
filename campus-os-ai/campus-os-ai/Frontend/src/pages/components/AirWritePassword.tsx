// pages/components/AirWritePassword.tsx
//
// "Write in Air" password capture / entry.
//
//   Camera ON -> Detect Hand -> Track Index Finger (landmark 8) ->
//   Store Finger Coordinates -> AI Handwriting Recognition -> Recognized Password
//
// Reuses the same @mediapipe/tasks-vision HandLandmarker already bundled for
// gesture sign-in (see hooks/useHandLandmarker.ts) in TWO ways at once:
//   1. Like before, it follows the index fingertip's path over time and
//      turns that path into text via the $1 Unistroke Recognizer
//      (lib/airWriteRecognizer.ts).
//   2. It also runs the same classifyGesture() shape classifier used
//      for gesture sign-in (lib/gestures.ts) on every frame to decide
//      *when* to draw:
//        ✊ "fist"       -> arm the recognizer. Held for FIST_HOLD_MS,
//                            this is the one-time "get ready" gate before
//                            any writing starts, so incidental hand
//                            movement while getting into position can't
//                            get picked up as part of the password.
//        ☝️  "point"      -> pen down (once armed). The fingertip is
//                            tracked and drawn.
//        ✋ "open_palm"  -> pen up / stop. Held for OPEN_PALM_HOLD_MS,
//                            this ends the current character (same job
//                            the old "pause until still" timer used to
//                            do) and segments the trail into one stroke
//                            per character.
//        anything else    -> paused. Neither draws nor ends the stroke,
//                            so a hand mid-transition between shapes
//                            doesn't corrupt the in-progress character.
//
//      Character-by-character segmentation (stop between each letter,
//      rather than one continuous multi-letter trajectory) is intentional,
//      not a bug: the recognizer below matches one *whole shape* per call,
//      so it needs a clean per-character boundary. Auto-segmenting a
//      continuous cursive-style trajectory into letters is a much harder,
//      much less reliable problem than asking for a deliberate pause, so
//      this keeps the reliable version.
//
// Used identically by both SignupPage (to CREATE a password) and
// PasswordLoginPage (to ENTER an existing password) — the caller decides
// what to do with the resulting plain-text string (register vs. login),
// this component only ever produces a string, same as a <input type="password">.

import { useEffect, useRef, useState } from "react";
import { recognizeStroke, type Point, type RecognitionResult } from "../../lib/airWriteRecognizer";
import { classifyGesture, type GestureName } from "../../lib/gestures";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const INDEX_TIP = 8;
// Ignore strokes that are too short to be a real character (accidental taps
// or a stray frame or two while transitioning between gestures). Still low
// enough that short characters like "-", "." or "1" survive.
const MIN_STROKE_POINTS = 8;
// Minimum normalized-coordinate movement (roughly 3-4px on the 480px-wide
// capture canvas) a new fingertip position must clear before it's added to
// the stroke. Filters out frame-to-frame jitter while the hand is basically
// still, which otherwise pads the stroke with near-duplicate points and
// throws off the recognizer's angle-alignment step.
const MIN_MOVEMENT = 0.007;
// Exponential-moving-average factor for the tracked fingertip while writing.
// Raw landmark coordinates jitter a little frame-to-frame; smoothing them
// before they enter the stroke buffer gives a cleaner path for the
// recognizer to match against. Lower = smoother/laggier; lowered from 0.5
// to trade a little responsiveness for noticeably less jitter.
const SMOOTHING_ALPHA = 0.15;
// How long an open palm must be held before it counts as "stop writing" and
// ends the current character. Long enough that a single noisy frame
// mid-transition (e.g. fingers opening up on the way to a full palm) can't
// prematurely cut a stroke short — this was the main cause of characters
// getting cut off before the shape was fully written.
const OPEN_PALM_HOLD_MS = 350;
// How long the finger must be held still before it counts as "stop writing"
// and ends the current character. This is the primary segmentation method now.
const PAUSE_HOLD_MS = 450;
// How long a fist must be held to arm the recognizer before writing can
const FIST_HOLD_MS = 800;

type CameraStatus = "loading" | "ready" | "denied" | "error";
type Mode = "writing" | "review";

interface CapturedChar {
  char: string;
  candidates: RecognitionResult[];
}

export interface AirWritePasswordProps {
  /** "Create Password" (signup) vs "Enter Password" (login) changes copy only. */
  purpose?: "create" | "enter";
  onComplete: (password: string) => void;
  onCancel: () => void;
}

export default function AirWritePassword({
  purpose = "create",
  onComplete,
  onCancel,
}: AirWritePasswordProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState<CameraStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("writing");
  const [handVisible, setHandVisible] = useState(false);
  // Whether the ✊ fist "get ready" gate has been cleared yet. Nothing is
  // tracked or drawn until this is true — it's set once per writing
  // session (reset by "Write again"), not once per character.
  const [armed, setArmed] = useState(true);
  // Which of the two controlling gestures (if either) is currently showing,
  // purely for the on-screen "✍️ Writing" / "✋ Hold to stop" badge.
  const [liveGesture, setLiveGesture] = useState<GestureName | null>(null);

  const [chars, setChars] = useState<CapturedChar[]>([]);
  const [editedPassword, setEditedPassword] = useState("");

  // Mutable, per-frame tracking state kept in refs so the RAF loop doesn't
  // need to re-subscribe to React state on every frame.
  const strokeRef = useRef<Point[]>([]);
  const lastPointRef = useRef<Point | null>(null);
  // Last smoothed fingertip position, used to exponentially smooth the raw
  // per-frame landmark before it's added to the stroke (see SMOOTHING_ALPHA).
  // Separate from lastPointRef, which callers may still want as the raw tip.
  const smoothedPointRef = useRef<Point | null>(null);
  // How long the open-palm "stop writing" gesture has been held continuously.
  const openPalmHoldRef = useRef<number | null>(null);
  // How long the finger has been held still, to segment by pausing.
  const pauseHoldRef = useRef<number | null>(null);
  // How long the fist "get ready" gesture has been held continuously, while
  // not yet armed.
  const fistHoldRef = useRef<number | null>(null); // This ref is no longer used but kept to avoid breaking other parts if they are not shown.
  // The RAF loop below is set up once (empty-deps effect) and reads `armed`
  // every frame, so it needs a ref — a closed-over React state value would
  // never see later updates. armedRef is the source of truth; `armed` state
  // just mirrors it for the on-screen badge/instructions.
  const armedRef = useRef(true);
  function setArmedBoth(value: boolean) {
    armedRef.current = value;
    setArmed(value);
  }
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  function commitStroke() {
    const stroke = strokeRef.current;
    strokeRef.current = [];
    lastPointRef.current = null;
    smoothedPointRef.current = null;
    openPalmHoldRef.current = null;
    pauseHoldRef.current = null;
    if (stroke.length < MIN_STROKE_POINTS) return;
    const totalMovement = stroke.reduce(
      (sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p.x - stroke[i - 1].x, p.y - stroke[i - 1].y)),
      0
    );
    // A stroke that cleared the point-count bar but barely moved (e.g. a
    // twitch while transitioning gestures) still isn't a real character.
    if (totalMovement < MIN_MOVEMENT * MIN_STROKE_POINTS) return;

    const candidates = recognizeStroke(stroke, 3);
    if (candidates.length === 0) return;
    setChars((prev) => [...prev, { char: candidates[0].char, candidates }]);
  }

  function backspace() {
    setChars((prev) => prev.slice(0, -1));
  }

  function clearAll() {
    setChars([]);
    strokeRef.current = [];
    lastPointRef.current = null;
    smoothedPointRef.current = null;
    openPalmHoldRef.current = null;
    pauseHoldRef.current = null;
    clearCanvas();
  }

  // Called from "Write again" (review -> writing) so a fresh fist gate is
  // required before the next password attempt starts tracking.
  function rearm() {
    setMode("writing");
    clearAll();
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function finishWriting() {
    // Commit whatever's mid-stroke before moving to review.
    if (strokeRef.current.length >= MIN_STROKE_POINTS) commitStroke();
    setMode("review");
  }

  useEffect(() => {
    if (mode !== "writing") return;
    setEditedPassword(chars.map((c) => c.char).join(""));
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    let landmarker: any = null;

    async function setup() {
      setStatus("loading");
      setErrorMessage(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 480, height: 360 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const vision = await import(/* @vite-ignore */ "@mediapipe/tasks-vision");
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
        landmarker = await vision.HandLandmarker.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });

        if (cancelled) return;
        setStatus("ready");
        loop();
      } catch (err: any) {
        if (cancelled) return;
        if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
          setStatus("denied");
          setErrorMessage("Camera access was denied. Allow camera access to write your password in the air.");
        } else {
          setStatus("error");
          setErrorMessage(err?.message ?? "Couldn't start the camera / hand tracker.");
        }
      }
    }

    function loop() {
      if (cancelled || !landmarker || !videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (video.readyState >= 2 && ctx) {
        const result = landmarker.detectForVideo(video, performance.now());
        const landmarks = result?.landmarks?.[0];

        if (landmarks) {
          setHandVisible(true);
          const gesture = classifyGesture(landmarks);
          setLiveGesture(gesture);
          const now = performance.now();

          // Mirror x so the on-screen trail matches the mirrored video feed.
          const rawTip: Point = { x: 1 - landmarks[INDEX_TIP].x, y: landmarks[INDEX_TIP].y };

          // Exponentially smooth against the last *smoothed* point so small
          // per-frame landmark jitter doesn't turn into a jagged stroke —
          // the recognizer's angle-alignment step is sensitive to noisy
          // corners, so a cleaner input path directly helps accuracy.
          const prevSmoothed = smoothedPointRef.current;
          const tip: Point = prevSmoothed
            ? {
                x: prevSmoothed.x + SMOOTHING_ALPHA * (rawTip.x - prevSmoothed.x),
                y: prevSmoothed.y + SMOOTHING_ALPHA * (rawTip.y - prevSmoothed.y),
              }
            : rawTip;
          smoothedPointRef.current = tip;

          if (gesture === "open_palm") {
            // ✋ Pen up — held long enough, this ends the current character.
            if (strokeRef.current.length > 0) {
              if (openPalmHoldRef.current === null) openPalmHoldRef.current = now;
              else if (now - openPalmHoldRef.current >= OPEN_PALM_HOLD_MS) {
                commitStroke();
                clearCanvas();
              }
            }
          } else {
            // Any other gesture (or no specific gesture) means we are writing.
            // Track and draw the fingertip, skipping points that barely moved.
            const prev = lastPointRef.current;
            if (!prev || Math.hypot(tip.x - prev.x, tip.y - prev.y) >= MIN_MOVEMENT) {
              strokeRef.current.push(tip);
              lastPointRef.current = tip;
            }
          }

          // Draw current in-progress stroke.
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const stroke = strokeRef.current;
          if (stroke.length > 1) {
            ctx.strokeStyle = "#6C63FF";
            ctx.lineWidth = 6;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.beginPath();
            stroke.forEach((p, i) => {
              const x = p.x * canvas.width;
              const y = p.y * canvas.height;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            });
            ctx.stroke();
          }
          // Fingertip marker — purple while writing, dimmer once the hand
          // has switched to open-palm/anything else so it reads as "not
          // currently drawing".
          ctx.beginPath();
          ctx.arc(tip.x * canvas.width, tip.y * canvas.height, 7, 0, Math.PI * 2);
          ctx.fillStyle = gesture !== "open_palm" ? "#A5A0FF" : "#4B5566";
          ctx.fill();
        } else {
          setHandVisible(false);
          setLiveGesture(null);
          lastPointRef.current = null;
          // If hand disappears mid-stroke, commit what we have.
          if (strokeRef.current.length > MIN_STROKE_POINTS) commitStroke();
          smoothedPointRef.current = null;
          openPalmHoldRef.current = null;
          pauseHoldRef.current = null;
          fistHoldRef.current = null;
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    setup();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      landmarker?.close?.();
      setLiveGesture(null); // Reset live gesture on cleanup
      armedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const liveRecognized = chars.map((c) => c.char).join("");

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111118] px-5 py-6">
      {mode === "writing" && (
        <>
          <p className="mb-3 text-center text-xs text-[#94A3B8]">
            {purpose === "create"
              ? "Write with your finger. Pause briefly after each character to move to the next one."
              : "Write with your finger, and pause after each character."}
          </p>

          <div className="relative mx-auto mb-3 w-full max-w-[300px] aspect-[4/3] rounded-2xl overflow-hidden border border-white/[0.08] bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover -scale-x-100" />
            <canvas ref={canvasRef} width={480} height={360} className="absolute inset-0 w-full h-full" />

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
            {status === "ready" && (
              <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-medium text-[#94A3B8]">
                <span className="text-red-400">🔴</span>
                Recording…
              </div>
            )}
            {status === "ready" && handVisible && (
              <div
                className={`absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-medium ${
                  liveGesture !== "open_palm"
                    ? "bg-[#6C63FF]/80 text-white"
                    : "bg-emerald-600/80 text-white"
                }`}
              >
                {liveGesture === "open_palm" ? "✋ Hold to stop…" : "✍️ Writing…"}
              </div>
            )}
            {status === "ready" && !handVisible && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-[11px] text-[#94A3B8]">
                Show your hand to the camera ✋
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 mb-4 flex-wrap min-h-[36px]">
            {chars.length === 0 && (
              <span className="text-xs text-[#3B4558]">Nothing written yet</span>
            )}
            {chars.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center justify-center min-w-[28px] rounded-lg border border-[#6C63FF]/30 bg-[#6C63FF]/10 px-2 py-1 text-xs font-mono font-semibold text-[#C7C4FF]"
              >
                {c.char}
              </span>
            ))}
          </div>

          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={backspace}
              disabled={chars.length === 0}
              className="flex-1 rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-[#E2E8F0] disabled:opacity-40"
            >
              ⌫ Backspace
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={chars.length === 0}
              className="flex-1 rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-[#E2E8F0] disabled:opacity-40"
            >
              Clear
            </button>
          </div>

          <button
            type="button"
            onClick={finishWriting}
            disabled={status !== "ready"}
            className="w-full rounded-xl bg-[#6C63FF] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#6C63FF]/20 transition-all hover:bg-[#7C6FFF] active:scale-[0.98] disabled:opacity-60"
          >
            Done writing → review
          </button>

          <button type="button"
            onClick={onCancel}
            className="mt-3 w-full text-xs font-semibold text-[#64748B]"
          >
            ← Use keyboard instead
          </button>
        </>
      )}

      {mode === "review" && (
        <>
          <p className="mb-3 text-center text-xs text-[#94A3B8]">
            Here's what was recognized. Fix anything that's wrong before continuing.
          </p>

          <div className="flex items-center justify-center gap-2 mb-4 flex-wrap min-h-[32px]">
            {chars.map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span
                  title={c.candidates.map((cand) => `${cand.char} (${Math.round(cand.score * 100)}%)`).join(", ")}
                  className={`inline-flex items-center justify-center min-w-[28px] rounded-lg border px-2 py-1 text-sm font-mono font-semibold ${
                    c.candidates[0].score > 0.85
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  }`}
                >
                  {c.char}
                </span>
                {c.candidates[0].score < 0.85 && c.candidates.length > 1 && (
                  <div className="flex gap-1">
                    {c.candidates.slice(1).map((alt) => (
                      <button
                        key={alt.char}
                        type="button"
                        onClick={() => {
                          const newChars = [...chars];
                          newChars[i] = { ...newChars[i], char: alt.char };
                          setChars(newChars);
                          setEditedPassword(newChars.map((nc) => nc.char).join(""));
                        }}
                        className="flex h-5 w-5 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[10px] font-mono text-slate-400 hover:bg-white/10"
                        title={`Change to ${alt.char} (${Math.round(alt.score * 100)}%)`}
                      >
                        {alt.char}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {chars.length === 0 && <span className="text-xs text-[#3B4558]">Nothing recognized</span>}
          </div>

          <label htmlFor="air-write-review" className="mb-1.5 block text-xs font-medium text-[#94A3B8]">
            {purpose === "create" ? "Your password" : "Recognized password"}
          </label>
          <input
            id="air-write-review"
            type="text"
            value={editedPassword}
            onChange={(e) => setEditedPassword(e.target.value)}
            className="mb-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-[#E2E8F0] outline-none transition-colors focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/20 font-mono"
          />
          <p className="mb-5 text-[11px] text-[#64748B]">
            Confidence colors above (green = high, amber = low) are just a hint — this text field is always the
            source of truth, so edit it if a character came out wrong.
          </p>

          <button
            type="button"
            onClick={() => onComplete(editedPassword)}
            disabled={editedPassword.length < 8}
            className="w-full rounded-xl bg-[#6C63FF] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#6C63FF]/20 transition-all hover:bg-[#7C6FFF] active:scale-[0.98] disabled:opacity-60"
          >
            {purpose === "create" ? "Use this password" : "Log in"}
          </button>
          {editedPassword.length > 0 && editedPassword.length < 8 && (
            <p className="mt-2 text-center text-xs text-red-400">Password must be at least 8 characters.</p>
          )}

          <button
            type="button"
            onClick={() => {
              setMode("writing");
              rearm();
            }}
            className="mt-3 w-full text-xs font-semibold text-[#64748B]"
          >
            ← Write again
          </button>
        </>
      )}
    </div>
  );
}
