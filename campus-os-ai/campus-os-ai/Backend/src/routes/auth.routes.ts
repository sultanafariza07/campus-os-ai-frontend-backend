import { Router } from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../db/index.js'
import { config } from '../config.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { z } from 'zod'

export const authRouter = Router()

// 10 attempts / 15 minutes per IP+route — enough headroom for real users
// mistyping a password a few times, tight enough to blunt naive brute force.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 })

const RegisterPayload = z.object({
  name: z.string().trim().min(1, 'name is required').max(255, 'name must be 255 characters or fewer'),
  email: z.string().trim().email('enter a valid email address'),
  password: z.string().min(8, 'password must be at least 8 chars'),
})

authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = RegisterPayload.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }
    const { name, email, password } = parsed.data

    const password_hash = await bcrypt.hash(password, 10)

    try {
      const rows = await query<{ id: number }>(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        [name, email.toLowerCase(), password_hash]
      )
      return res.status(201).json({ id: rows[0]?.id })
    } catch (e: any) {
      // Unique constraint on email
      if (String(e?.code) === '23505') return res.status(409).json({ error: 'email already exists' })
      throw e
    }
  })
)

// POST /api/auth/register-gesture — create an account using a captured
// gesture sequence instead of a typed password (used by the Signup page's
// gesture flow). The account still gets a password_hash under the hood
// (the column is NOT NULL and /login/password stays available as a
// fallback route elsewhere in the app), but it's a random value the user
// never sees or needs — gestures are the credential from here on out.
authRouter.post(
  '/register-gesture',
  authLimiter,
  asyncHandler(async (req, res) => {
    const GestureRegisterPayload = z.object({
      name: z.string().trim().min(1, 'name is required').max(255),
      email: z.string().trim().email('enter a valid email address'),
      branch: z.string().optional(),
      year: z.string().optional(),
      sequence: z.unknown(),
    })
    const parsed = GestureRegisterPayload.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }
    const { name, email, branch, year, sequence } = parsed.data

    const seqErr = validateSequence(sequence)
    if (seqErr) return res.status(400).json({ error: seqErr })

    const randomPassword = crypto.randomBytes(24).toString('hex')
    const password_hash = await bcrypt.hash(randomPassword, 10)

    try {
      // The type needs to be updated to include branch and year to match the RETURNING clause
      const rows = await query<{ id: number; name: string; email: string; branch: string | null; year: string | null }>(
        `INSERT INTO users (name, email, password_hash, branch, year, gesture_sequence, gesture_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING id, name, email`,
        [name, email.toLowerCase(), password_hash, branch ?? null, year ?? null, JSON.stringify(sequence)]
      )

      const user = rows[0]
      const token = jwt.sign({ sub: String(user.id) }, config.JWT_SECRET as jwt.Secret, {
        expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
      })

      return res.status(201).json({ token, user })
    } catch (e: any) {
      if (String(e?.code) === '23505') return res.status(409).json({ error: 'email already exists' })
      throw e
    }
  })
)

const LoginPayload = z.object({
  email: z.string().trim().email('enter a valid email address'),
  password: z.string().min(1, 'password is required'),
})

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = LoginPayload.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message })
    const { email, password } = parsed.data

    const users = await query<{ id: number; password_hash: string; name: string; email: string }>(
      'SELECT id, name, email, password_hash FROM users WHERE email=$1 LIMIT 1',
      [email.toLowerCase()]
    )

    const user = users[0]
    if (!user) return res.status(401).json({ error: 'Invalid email or password' })

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' })

    const token = jwt.sign({ sub: String(user.id) }, config.JWT_SECRET as jwt.Secret, {
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
    })

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    })
  })
)

// ─── Gesture login ──────────────────────────────────────────────────────────
// A lightweight "gesture PIN": the user records an ordered sequence of 3-6
// hand gestures (recognized client-side from webcam landmarks — see
// Frontend/src/lib/gestures.ts for the fixed vocabulary), and that sequence
// substitutes for a typed password on future logins.

const KNOWN_GESTURES = ['fist', 'open_palm', 'peace', 'thumbs_up', 'point', 'ok'] as const
const MIN_SEQ_LEN = 3
const MAX_SEQ_LEN = 6

function validateSequence(sequence: unknown): string | null {
  if (!Array.isArray(sequence)) return 'sequence must be an array of gesture names'
  if (sequence.length < MIN_SEQ_LEN || sequence.length > MAX_SEQ_LEN) {
    return `sequence must have between ${MIN_SEQ_LEN} and ${MAX_SEQ_LEN} gestures`
  }
  for (const g of sequence) {
    if (typeof g !== 'string' || !KNOWN_GESTURES.includes(g as any)) {
      return `unknown gesture: ${String(g)}`
    }
  }
  return null
}

// POST /api/auth/gesture/register — save/replace the signed-in user's gesture sequence.
authRouter.post(
  '/gesture/register',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { sequence } = req.body as { sequence?: unknown }
    const err = validateSequence(sequence)
    if (err) return res.status(400).json({ error: err })

    const userId = req.user!.id
    await query(
      'UPDATE users SET gesture_sequence = $1, gesture_enabled = TRUE WHERE id = $2',
      [JSON.stringify(sequence), userId]
    )

    return res.json({ ok: true })
  })
)

// DELETE /api/auth/gesture/register — turn gesture login back off for this account.
authRouter.delete(
  '/gesture/register',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    await query(
      'UPDATE users SET gesture_sequence = NULL, gesture_enabled = FALSE WHERE id = $1',
      [userId]
    )
    return res.json({ ok: true })
  })
)

// GET /api/auth/gesture/status?email=... — does this account have gesture login set up?
// Always returns a well-formed response (never 404) so the login page can't
// use this to enumerate which emails are registered.
authRouter.get(
  '/gesture/status',
  asyncHandler(async (req, res) => {
    const email = String(req.query.email ?? '').trim().toLowerCase()
    if (!email) return res.json({ gestureEnabled: false })

    const rows = await query<{ gesture_enabled: boolean }>(
      'SELECT gesture_enabled FROM users WHERE email = $1 LIMIT 1',
      [email]
    )
    return res.json({ gestureEnabled: Boolean(rows[0]?.gesture_enabled) })
  })
)

// POST /api/auth/gesture/login — authenticate with email + captured gesture sequence.
authRouter.post(
  '/gesture/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, sequence } = req.body as { email?: string; sequence?: unknown }
    if (!email?.trim()) return res.status(400).json({ error: 'email is required' })

    const seqErr = validateSequence(sequence)
    if (seqErr) return res.status(400).json({ error: seqErr })

    const users = await query<{
      id: number; name: string; email: string
      gesture_sequence: string | null; gesture_enabled: boolean
    }>(
      'SELECT id, name, email, gesture_sequence, gesture_enabled FROM users WHERE email=$1 LIMIT 1',
      [email.trim().toLowerCase()]
    )

    const user = users[0]
    // Same generic error for "no such user", "gestures not set up", and
    // "wrong sequence" — don't let this endpoint reveal which case it is.
    const genericError = { error: 'Gesture sign-in failed. Try again or use your password.' }

    if (!user || !user.gesture_enabled || !user.gesture_sequence) {
      return res.status(401).json(genericError)
    }

    let stored: string[]
    try {
      stored = JSON.parse(user.gesture_sequence)
    } catch {
      return res.status(401).json(genericError)
    }

    const submitted = sequence as string[]
    const matches = stored.length === submitted.length && stored.every((g, i) => g === submitted[i])
    if (!matches) return res.status(401).json(genericError)

    const token = jwt.sign({ sub: String(user.id) }, config.JWT_SECRET as jwt.Secret, {
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
    })

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    })
  })
)

authRouter.get(
  '/profile',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const rows = await query<{ id: number; name: string; email: string; branch: string | null; year: string | null }>(
      'SELECT id, name, email, branch, year FROM users WHERE id=$1',
      [userId]
    )

    if (!rows[0]) return res.status(404).json({ error: 'user not found' })
    return res.json({ user: rows[0] })
  })
)

// PATCH /api/auth/profile — update name/branch/year. Email and password are
// intentionally not editable here (email is the login identity; password
// changes deserve their own dedicated, re-auth-guarded flow, which is out of
// scope for this phase).
authRouter.patch(
  '/profile',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const UpdateProfilePayload = z.object({
      name: z.string().trim().min(1, 'name cannot be empty').max(255).optional(),
      branch: z.string().trim().max(100).optional(),
      year: z.string().trim().max(50).optional(),
    }).partial()

    const parsed = UpdateProfilePayload.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }
    if (Object.keys(parsed.data).length === 0) {
      return res.status(400).json({ error: 'at least one field to update must be provided' })
    }
    const { name, branch, year } = parsed.data

    const rows = await query<{ id: number; name: string; email: string; branch: string | null; year: string | null }>(
      `UPDATE users
       SET name = COALESCE($1, name),
           branch = COALESCE($2, branch),
           year = COALESCE($3, year)
       WHERE id = $4
       RETURNING id, name, email, branch, year`,
      [name, branch, year, userId]
    )

    if (!rows[0]) return res.status(404).json({ error: 'user not found' })
    return res.json({ user: rows[0] })
  })
)
