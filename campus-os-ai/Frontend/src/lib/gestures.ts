// lib/gestures.ts
//
// Fixed gesture vocabulary + a small, explainable landmark classifier —
// this is the browser/TypeScript port of the finger-state heuristic used by
// the original Python "AI Hand Authenticator" (hand_detector.py +
// gesture_recognizer.py), reworked to run on MediaPipe Tasks Vision's
// HandLandmarker output in the browser instead of OpenCV/MediaPipe Python.
//
// Each gesture is recognized from the 21 hand landmarks by checking, per
// finger, whether the fingertip is extended past its PIP joint (further
// from the wrist) — the same tip-vs-joint geometry the Python version used,
// just expressed against MediaPipe's normalized (x, y) landmark schema.

export type GestureName = "fist" | "open_palm" | "peace" | "thumbs_up" | "point" | "ok";

export const KNOWN_GESTURES: GestureName[] = [
  "fist",
  "open_palm",
  "peace",
  "thumbs_up",
  "point",
  "ok",
];

export const GESTURE_LABELS: Record<GestureName, { label: string; emoji: string }> = {
  fist: { label: "Fist", emoji: "✊" },
  open_palm: { label: "Open Palm", emoji: "✋" },
  peace: { label: "Peace Sign", emoji: "✌️" },
  thumbs_up: { label: "Thumbs Up", emoji: "👍" },
  point: { label: "Point", emoji: "☝️" },
  ok: { label: "OK Sign", emoji: "👌" },
};

export const MIN_SEQUENCE_LENGTH = 3;
export const MAX_SEQUENCE_LENGTH = 6;
export const DEFAULT_SEQUENCE_LENGTH = 4;

// A landmark as returned by @mediapipe/tasks-vision's HandLandmarker
// (normalized 0..1 image coordinates).
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

// MediaPipe Hands landmark indices (same schema in the JS and Python builds).
const WRIST = 0;
const THUMB_TIP = 4;
const THUMB_IP = 3;
const INDEX_TIP = 8;
const INDEX_PIP = 6;
const MIDDLE_TIP = 12;
const MIDDLE_PIP = 10;
const RING_TIP = 16;
const RING_PIP = 14;
const PINKY_TIP = 20;
const PINKY_PIP = 18;

function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** True if a non-thumb finger's tip is farther from the wrist than its PIP joint — i.e. extended. */
function isExtended(landmarks: Landmark[], tipIdx: number, pipIdx: number): boolean {
  const wrist = landmarks[WRIST];
  return dist(landmarks[tipIdx], wrist) > dist(landmarks[pipIdx], wrist) * 1.1;
}

/** Finger-state vector: [thumb, index, middle, ring, pinky], true = extended. */
export function fingerStates(landmarks: Landmark[]): boolean[] {
  const wrist = landmarks[WRIST];
  // Thumb extension is measured sideways (tip vs IP joint distance from wrist)
  // rather than up/down, since the thumb folds across the palm, not along it.
  const thumb = dist(landmarks[THUMB_TIP], wrist) > dist(landmarks[THUMB_IP], wrist) * 1.05;
  const index = isExtended(landmarks, INDEX_TIP, INDEX_PIP);
  const middle = isExtended(landmarks, MIDDLE_TIP, MIDDLE_PIP);
  const ring = isExtended(landmarks, RING_TIP, RING_PIP);
  const pinky = isExtended(landmarks, PINKY_TIP, PINKY_PIP);
  return [thumb, index, middle, ring, pinky];
}

/**
 * Classify a single frame's landmarks into one of the known gestures, or
 * null if the hand doesn't clearly match any of them. Mirrors the rule set
 * from the Python project's gesture_recognizer.py.
 */
export function classifyGesture(landmarks: Landmark[]): GestureName | null {
  if (!landmarks || landmarks.length < 21) return null;

  const [thumb, index, middle, ring, pinky] = fingerStates(landmarks);
  const extendedCount = [thumb, index, middle, ring, pinky].filter(Boolean).length;

  if (extendedCount === 0) return "fist";
  if (thumb && !index && !middle && !ring && !pinky) return "thumbs_up";
  if (!thumb && index && !middle && !ring && !pinky) return "point";
  if (!thumb && index && middle && !ring && !pinky) return "peace";
  // Require index + middle + at least one of ring/pinky extended, rather than
  // all four non-thumb fingers — the pinky landmark is the least reliably
  // tracked of the five, so demanding it too made the "stop writing" gesture
  // harder to trigger cleanly than it needed to be while writing.
  if (extendedCount >= 3 && index && middle && (ring || pinky)) return "open_palm";

  // OK sign: thumb tip and index tip touching (small distance), other three extended.
  const pinchDist = dist(landmarks[THUMB_TIP], landmarks[INDEX_TIP]);
  if (pinchDist < 0.06 && middle && ring && pinky) return "ok";

  return null;
}
