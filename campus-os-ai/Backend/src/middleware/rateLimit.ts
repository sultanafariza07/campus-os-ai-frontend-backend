import type { Request, Response, NextFunction } from 'express'

// Minimal fixed-window rate limiter, in-memory. Good enough to blunt naive
// brute-force attempts against /login and /register on a single-instance
// deployment. This is intentionally simple (no Redis, no new dependency) —
// if CampusOS ever runs multiple backend instances behind a load balancer,
// this should be swapped for a shared store (e.g. Redis-backed limiter).
interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function rateLimit(options: { windowMs: number; max: number }) {
  const { windowMs, max } = options

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const key = `${req.ip}:${req.path}`
    const now = Date.now()
    const bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    if (bucket.count >= max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000)
      res.setHeader('Retry-After', String(retryAfterSec))
      return res.status(429).json({ error: 'Too many requests. Please try again shortly.' })
    }

    bucket.count += 1
    next()
  }
}
