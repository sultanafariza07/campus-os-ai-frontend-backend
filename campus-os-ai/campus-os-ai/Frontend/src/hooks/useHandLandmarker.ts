// hooks/useHandLandmarker.ts
//
// Wraps @mediapipe/tasks-vision's HandLandmarker over the device webcam and
// turns raw per-frame landmarks into a debounced, "hold it steady" gesture
// signal — the browser equivalent of the Python project's
// camera.py -> hand_detector.py -> gesture_recognizer.py pipeline.
//
// A gesture only "confirms" once it has been the top classification for
// HOLD_MS continuously, which is what gives the login/setup UI its
// countdown-ring feel and (like the original project's liveness checks)
// prevents a single noisy frame from registering a false gesture.

import { useEffect, useRef, useState } from "react";
import { classifyGesture, type GestureName, type Landmark } from "../lib/gestures";

const HOLD_MS = 650;
const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export type CameraStatus = "idle" | "loading" | "ready" | "denied" | "error";

interface UseHandLandmarkerResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  status: CameraStatus;
  errorMessage: string | null;
  liveGesture: GestureName | null;
  /** 0..1 progress toward confirming liveGesture (hold-to-confirm ring). */
  holdProgress: number;
  /** Fires once when a gesture has been held steady for HOLD_MS. */
  onConfirm: (cb: (gesture: GestureName) => void) => void;
  /** Call after handling a confirm so the same gesture can be re-armed for the next step. */
  resetHold: () => void;
}

export function useHandLandmarker(active: boolean): UseHandLandmarkerResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveGesture, setLiveGesture] = useState<GestureName | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);

  const confirmCbRef = useRef<((g: GestureName) => void) | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const lastGestureRef = useRef<GestureName | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setStatus("idle");
      return;
    }

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

        // Loaded from CDN at runtime (not bundled) — keeps the wasm/model
        // payload out of the app bundle; requires network access in the
        // user's browser when the page runs.
        const vision = await import(
          /* @vite-ignore */ "@mediapipe/tasks-vision"
        );
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
          setErrorMessage("Camera access was denied. Allow camera access to sign in with gestures.");
        } else {
          setStatus("error");
          setErrorMessage(err?.message ?? "Couldn't start the camera / hand tracker.");
        }
      }
    }

    function loop() {
      if (cancelled || !landmarker || !videoRef.current) return;
      const video = videoRef.current;

      if (video.readyState >= 2) {
        const result = landmarker.detectForVideo(video, performance.now());
        const landmarks: Landmark[] | undefined = result?.landmarks?.[0];
        const gesture = landmarks ? classifyGesture(landmarks) : null;

        const now = performance.now();
        if (gesture && gesture === lastGestureRef.current) {
          if (holdStartRef.current === null) holdStartRef.current = now;
          const progress = Math.min(1, (now - holdStartRef.current) / HOLD_MS);
          setHoldProgress(progress);
          if (progress >= 1 && !firedRef.current) {
            firedRef.current = true;
            confirmCbRef.current?.(gesture);
          }
        } else {
          lastGestureRef.current = gesture;
          holdStartRef.current = gesture ? now : null;
          firedRef.current = false;
          setHoldProgress(0);
        }
        setLiveGesture(gesture);
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
      lastGestureRef.current = null;
      holdStartRef.current = null;
      firedRef.current = false;
      setLiveGesture(null);
      setHoldProgress(0);
    };
  }, [active]);

  function onConfirm(cb: (gesture: GestureName) => void) {
    confirmCbRef.current = cb;
  }

  function resetHold() {
    lastGestureRef.current = null;
    holdStartRef.current = null;
    firedRef.current = false;
    setHoldProgress(0);
  }

  return { videoRef, status, errorMessage, liveGesture, holdProgress, onConfirm, resetHold };
}
