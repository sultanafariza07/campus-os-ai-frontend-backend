import type { Request, Response, NextFunction } from 'express'

function isPgError(err: any): boolean {
  return !!err && typeof err === 'object' && (typeof err.code === 'string' || typeof err.severity === 'string')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, _req: Request, res: Response, next: NextFunction) {
  // Don't log here; let the final handler do it so we don't get double logs.
  if (res.headersSent) return

  const msg = typeof err?.message === 'string' ? err.message : ''

  // Make 500 actionable without leaking secrets.
  if (msg.includes('DATABASE_URL is not set')) {
    return res.status(500).json({ error: 'Internal server error', details: 'DATABASE_URL is not set' })
  }

  if (msg.includes('DATABASE_URL') && msg.includes('required')) {
    return res.status(500).json({ error: 'Internal server error', details: msg })
  }

  if (isPgError(err)) {
    // In development, we want the full error to be passed to the final
    // handler so we can see the stack trace and details on the client.
    // In production, we return a generic error for security.
    if (process.env.NODE_ENV === 'production') {
      // Examples: 42P01 table missing, 42703 column missing, etc.
      const details = err?.detail ?? err?.hint ?? err?.message
      return res.status(500).json({
        error: 'Internal server error',
        details: typeof details === 'string' ? details : 'Database error'
      })
    }
  }

  // If we can't handle it here, pass it to the next error handler
  next(err)
}
