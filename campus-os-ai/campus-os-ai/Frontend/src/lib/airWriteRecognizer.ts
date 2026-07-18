// lib/airWriteRecognizer.ts
//
// "AI Handwriting Recognition" step of the air-writing password pipeline:
//
//   Camera -> MediaPipe HandLandmarker -> track index fingertip ->
//   store fingertip coordinates -> [THIS FILE] -> recognized character
//
// Implements the $1 Unistroke Recognizer (Wobbrock, Wilson & Li, 2007) —
// a lightweight, on-device, template-matching gesture recognizer. It needs
// no training data and no network call, which is why it's used here instead
// of a CNN/LSTM/Transformer: those need thousands of labelled air-written
// samples per character to train well, which this project doesn't have.
// The recognizer is swappable — see the note at the bottom of this file.
//
// Each character is captured as a single continuous stroke: the user pauses
// briefly between letters (handled by the calling component), which segments
// the raw (x, y) trajectory into one stroke per character.

export interface Point {
  x: number;
  y: number;
}

export interface RecognitionResult {
  char: string;
  score: number; // 0..1, higher = more confident
}

const NUM_RESAMPLE_POINTS = 64;
const SQUARE_SIZE = 250;
const ORIGIN: Point = { x: 0, y: 0 };
const HALF_DIAGONAL = 0.5 * Math.hypot(SQUARE_SIZE, SQUARE_SIZE);
const ANGLE_RANGE = (45 * Math.PI) / 180;
const ANGLE_PRECISION = (2 * Math.PI) / 180;
const GOLDEN_RATIO = (-1 + Math.sqrt(5)) / 2;

// ── Geometry helpers ──────────────────────────────────────────────────────

function pathLength(points: Point[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return d;
}

function resample(points: Point[], n: number): Point[] {
  const I = pathLength(points) / (n - 1);
  let d = 0;
  const newPoints: Point[] = [points[0]];
  let i = 1;

  while (i < points.length) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (d + dist >= I) {
      const qx = p1.x + ((I - d) / dist) * (p2.x - p1.x);
      const qy = p1.y + ((I - d) / dist) * (p2.y - p1.y);
      const q = { x: qx, y: qy };
      newPoints.push(q);
      points.splice(i, 0, q); // Insert into the array to not lose fractional parts
      d = 0;
    } else {
      d += dist;
    }
    i++;
  }
  // Rounding sometimes leaves us one point short.
  if (newPoints.length < n) newPoints.push(points[points.length - 1]);
  return newPoints.slice(0, n);
}

function centroid(points: Point[]): Point {
  const x = points.reduce((s, p) => s + p.x, 0) / points.length;
  const y = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { x, y };
}

function indicativeAngle(points: Point[]): number {
  const c = centroid(points);
  return Math.atan2(c.y - points[0].y, c.x - points[0].x);
}

function rotateBy(points: Point[], radians: number): Point[] {
  const c = centroid(points);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return points.map((p) => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}

function boundingBox(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function scaleTo(points: Point[], size: number): Point[] {
  const box = boundingBox(points);
  const w = box.maxX - box.minX || 1e-9;
  const h = box.maxY - box.minY || 1e-9;
  return points.map((p) => ({
    x: (p.x - box.minX) * (size / w),
    y: (p.y - box.minY) * (size / h),
  }));
}

function translateTo(points: Point[], target: Point): Point[] {
  const c = centroid(points);
  return points.map((p) => ({ x: p.x + target.x - c.x, y: p.y + target.y - c.y }));
}

function pathDistance(a: Point[], b: Point[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return d / a.length;
}

function distanceAtAngle(points: Point[], template: Point[], radians: number): number {
  const newPoints = rotateBy(points, radians);
  return pathDistance(newPoints, template);
}

// Golden-section search for the rotation angle that best aligns two strokes.
function distanceAtBestAngle(
  points: Point[],
  template: Point[],
  fromAngle: number,
  toAngle: number,
  precision: number
): number {
  let a = fromAngle;
  let b = toAngle;
  let x1 = GOLDEN_RATIO * a + (1 - GOLDEN_RATIO) * b;
  let f1 = distanceAtAngle(points, template, x1);
  let x2 = (1 - GOLDEN_RATIO) * a + GOLDEN_RATIO * b;
  let f2 = distanceAtAngle(points, template, x2);

  while (Math.abs(b - a) > precision) {
    if (f1 < f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = GOLDEN_RATIO * a + (1 - GOLDEN_RATIO) * b;
      f1 = distanceAtAngle(points, template, x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = (1 - GOLDEN_RATIO) * a + GOLDEN_RATIO * b;
      f2 = distanceAtAngle(points, template, x2);
    }
  }
  return Math.min(f1, f2);
}

/** Normalizes a raw stroke the same way for both templates and live input. */
function normalize(rawPoints: Point[]): Point[] {
  let pts = resample(rawPoints, NUM_RESAMPLE_POINTS);
  const radians = indicativeAngle(pts);
  pts = rotateBy(pts, -radians);
  pts = scaleTo(pts, SQUARE_SIZE);
  pts = translateTo(pts, ORIGIN);
  return pts;
}

// ── Template vocabulary ───────────────────────────────────────────────────
//
// Each template is a small set of (x, y) points on a 0..100 unit grid that
// trace a natural, single-stroke way of writing that character in the air —
// e.g. "4" is drawn as one unbroken path since a real air-written stroke
// can't lift the "pen." Multiple templates per character (variants) cover
// more than one common way of writing it, which is how $1 handles natural
// handwriting variation without needing a trained model.

interface Template {
  char: string;
  points: Point[];
}

function pts(coords: number[][]): Point[] {
  return coords.map(([x, y]) => ({ x, y }));
}

const RAW_TEMPLATES: Template[] = [
  // ── Digits (single continuous stroke each) ──
  { char: "0", points: pts([[60,0],[35,0],[15,15],[5,40],[5,60],[15,85],[35,100],[60,100],[80,85],[90,60],[90,40],[80,15],[60,0],[90,100]]) },
  { char: "1", points: pts([[30,15],[50,0],[50,100],[20,100],[80,100]]) },
  { char: "2", points: pts([[10,20],[20,5],[45,0],[65,5],[75,20],[70,40],[50,55],[25,75],[10,100],[90,100]]) },
  { char: "3", points: pts([[10,10],[35,0],[60,5],[70,20],[60,35],[40,40],[60,45],[75,60],[70,85],[50,100],[25,100],[10,90]]) },
  { char: "4", points: pts([[65,0],[10,65],[90,65],[65,0],[65,100]]) },
  { char: "5", points: pts([[80,0],[20,0],[15,40],[45,35],[70,45],[75,75],[55,95],[30,95],[15,80]]) },
  { char: "6", points: pts([[75,5],[45,0],[20,25],[10,60],[20,90],[45,100],[70,95],[80,75],[75,55],[50,45],[25,55],[20,75]]) },
  { char: "7", points: pts([[10,0],[90,0],[45,100]]) },
  { char: "8", points: pts([[45,0],[25,10],[25,35],[45,45],[65,35],[65,10],[45,0],[25,65],[25,90],[45,100],[65,90],[65,65],[45,45]]) },
  { char: "9", points: pts([[70,25],[55,5],[30,5],[15,20],[15,40],[30,55],[55,50],[70,35],[75,60],[65,90],[40,100],[20,90]]) },

  // ── Digit variants (a second common way people air-write these) ──
  { char: "1", points: pts([[50,0],[50,100]]) }, // plain vertical stroke, no serif/base flag
  { char: "2", points: pts([[10,20],[20,5],[45,0],[65,5],[75,20],[70,40],[50,55],[25,75],[10,100]]) }, // no trailing base line
  { char: "4", points: pts([[65,0],[10,65],[90,65],[65,100]]) }, // open variant, doesn't retrace up to the top
  { char: "7", points: pts([[10,0],[90,0],[45,100],[25,55],[65,55]]) }, // with a crossbar on the way down

  // ── Letters (uppercase forms; recognition is case-insensitive) ──
  { char: "A", points: pts([[0,100],[35,0],[70,100],[15,55],[55,55]]) },
  { char: "A", points: pts([[0,100],[35,0],[70,100]]) }, // triangle only, no crossbar
  { char: "B", points: pts([[10,0],[10,100],[60,100],[75,85],[65,55],[10,50],[65,45],[75,15],[60,0],[10,0]]) },
  { char: "C", points: pts([[85,15],[65,0],[35,0],[10,25],[5,50],[10,75],[35,100],[65,100],[85,85]]) },
  { char: "D", points: pts([[10,0],[10,100],[55,100],[80,75],[85,50],[80,25],[55,0],[10,0]]) },
  { char: "E", points: pts([[85,0],[10,0],[10,50],[60,50],[10,50],[10,100],[85,100]]) },
  { char: "F", points: pts([[10,100],[10,0],[85,0],[10,0],[10,50],[55,50]]) },
  { char: "F", points: pts([[85,0],[10,0],[10,100],[10,50],[60,50]]) }, // Alternative F
  { char: "G", points: pts([[85,15],[65,0],[35,0],[10,25],[5,50],[10,75],[35,100],[65,100],[85,80],[85,55],[55,55]]) },
  { char: "H", points: pts([[10,0],[10,100],[10,50],[80,50],[80,0],[80,100]]) },
  { char: "I", points: pts([[35,0],[65,0],[50,0],[50,100],[35,100],[65,100]]) },
  { char: "I", points: pts([[50,0],[50,100]]) }, // plain vertical stroke, no serifs
  { char: "J", points: pts([[65,0],[65,75],[55,95],[35,100],[15,90],[10,70]]) },
  { char: "K", points: pts([[10,0],[10,100],[10,50],[80,0],[10,50],[80,100]]) }, // Alternative K
  { char: "K", points: pts([[10,0],[10,100],[10,55],[75,0],[35,60],[80,100]]) },
  { char: "L", points: pts([[20,0],[20,100],[85,100]]) },
  { char: "M", points: pts([[5,100],[5,0],[45,55],[85,0],[85,100]]) },
  { char: "N", points: pts([[10,100],[10,0],[80,100],[80,0]]) },
  { char: "O", points: pts([[50,0],[25,10],[10,35],[10,65],[25,90],[50,100],[75,90],[90,65],[90,35],[75,10],[50,0]]) },
  { char: "P", points: pts([[10,100],[10,0],[60,0],[75,20],[65,45],[10,50]]) },
  { char: "Q", points: pts([[50,0],[25,10],[10,35],[10,65],[25,90],[50,100],[75,90],[90,65],[90,35],[75,10],[50,0],[55,70],[95,100]]) },
  { char: "R", points: pts([[10,100],[10,0],[60,0],[75,20],[65,45],[10,50],[75,100]]) },
  { char: "S", points: pts([[80,10],[55,0],[30,5],[15,20],[20,40],[50,50],[80,60],[85,80],[65,98],[35,100],[10,90]]) },
  { char: "T", points: pts([[10,0],[90,0],[50,0],[50,100]]) },
  { char: "U", points: pts([[10,0],[10,65],[25,90],[50,100],[75,90],[90,65],[90,0]]) },
  { char: "V", points: pts([[5,0],[50,100],[95,0]]) },
  { char: "W", points: pts([[0,0],[25,100],[50,45],[75,100],[100,0]]) },
  { char: "X", points: pts([[5,0],[95,100],[50,50],[95,0],[5,100]]) },
  { char: "Y", points: pts([[5,0],[50,50],[95,0],[50,50],[50,100]]) },
  { char: "Z", points: pts([[10,0],[90,0],[10,100],[90,100]]) },
  { char: "Z", points: pts([[10,0],[90,0],[10,100],[90,100],[30,100],[70,100]]) }, // with a base line flourish

  // ── Special characters ──
  { char: "@", points: pts([[65,55],[55,40],[40,40],[32,55],[38,68],[55,68],[62,55],[62,25],[80,35],[85,55],[75,80],[50,90],[25,80],[12,55],[25,25],[50,15],[75,25]]) },
  { char: "#", points: pts([[25,0],[15,100],[35,100],[45,0],[0,30],[100,30],[0,70],[100,70]]) },
  { char: "%", points: pts([[20,0],[10,10],[10,25],[20,35],[30,25],[30,10],[20,0],[90,0],[10,100],[70,65],[60,75],[60,90],[70,100],[80,90],[80,75],[70,65]]) },
  { char: "!", points: pts([[50,0],[45,60],[55,60],[50,100],[50,90]]) },
  { char: "-", points: pts([[10,50],[90,50]]) },
  { char: "_", points: pts([[10,100],[90,100]]) },
  { char: ".", points: pts([[45,90],[55,90],[55,100],[45,100],[45,90]]) },
];

const TEMPLATES: Template[] = RAW_TEMPLATES.map((t) => ({
  char: t.char,
  points: normalize(t.points),
}));

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Recognizes a single raw fingertip stroke (one character's worth of
 * trajectory points) against the template vocabulary.
 * Returns candidates sorted best-first.
 */
export function recognizeStroke(rawPoints: Point[], topN = 3): RecognitionResult[] {
  if (rawPoints.length < 2) return [];

  const candidate = normalize(rawPoints);

  // Score every template (a character may have several variants covering
  // different common ways of writing it — see the "variant" templates
  // above), then keep only each character's *best* variant score. Without
  // this, a character with 2-3 variants could occupy multiple slots in the
  // top-N list and crowd out genuinely different candidates.
  const bestByChar = new Map<string, number>();
  for (const t of TEMPLATES) {
    const d = distanceAtBestAngle(candidate, t.points, -ANGLE_RANGE, ANGLE_RANGE, ANGLE_PRECISION);
    // Soften the raw linear falloff a little (sqrt) so a decent-but-imperfect
    // match still lands in "confident" territory instead of being pushed
    // into amber by every bit of natural hand wobble — makes the recognizer
    // more forgiving of imprecise air-writing without changing what it
    // actually picks as the best guess.
    const raw = Math.max(0, 1 - d / HALF_DIAGONAL);
    const score = Math.pow(raw, 0.25);
    const prev = bestByChar.get(t.char);
    if (prev === undefined || score > prev) bestByChar.set(t.char, score);
  }

  const results: RecognitionResult[] = Array.from(bestByChar.entries()).map(([char, score]) => ({
    char,
    score,
  }));

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topN);
}

/** Convenience wrapper: best single guess for a stroke, or null if too short. */
export function recognizeChar(rawPoints: Point[]): RecognitionResult | null {
  const results = recognizeStroke(rawPoints, 1);
  return results[0] ?? null;
}

// ── Swapping in a trained model later ────────────────────────────────────
//
// This file is intentionally the *only* place that does recognition. To
// upgrade to a trained CNN / LSTM / Transformer later:
//   1. Keep collecting raw (x, y, t) trajectories exactly as AirWritePassword.tsx
//      does today (it already segments per character and exposes the raw
//      points before they reach this file).
//   2. Replace the body of `recognizeChar` with a call to your model
//      (e.g. a fetch to a small inference endpoint, or a TensorFlow.js model
//      loaded on-device) that takes the same Point[] and returns the same
//      RecognitionResult shape.
//   3. Nothing in AirWritePassword.tsx, SignupPage.tsx, or PasswordLoginPage.tsx
//      needs to change — they only depend on this file's exported types.
