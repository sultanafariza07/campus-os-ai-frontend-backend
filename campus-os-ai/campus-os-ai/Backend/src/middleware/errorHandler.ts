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
    // For database errors, provide the detail/hint from the error if available.
    // This is safe as it doesn't leak connection details or stack traces.
    const details = err?.detail ?? err?.hint ?? err?.message
    return res.status(500).json({
      error: 'Internal server error',
      details: typeof details === 'string' ? details : 'A database error occurred.'
    })
  }

  // If we can't handle it here, pass it to the next error handler
  next(err)
}
