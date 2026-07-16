import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import { config } from '../config.js'

export type AuthedRequest = Request & { user?: { id: number } }

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.header('Authorization')
  if (!header) return res.status(401).json({ error: 'Missing Authorization header' })

  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Invalid Authorization header' })

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { sub: string }
    req.user = { id: Number(decoded.sub) }
    if (!Number.isFinite(req.user.id)) throw new Error('Invalid user id in token')
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

