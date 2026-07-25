import type { Request, Response, NextFunction } from 'express'

function isPgError(err: any): boolean {
  return !!err && typeof err === 'object' && (typeof err.code === 'string' || typeof err.severity === 'string')
}

// Express identifies error-handling middleware by its 4-argument signature,
// so `next` must stay in the signature even though it's never called here
// (every branch below responds with JSON instead of delegating further).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // Don't log here; let the final handler do it so we don't get double logs.
  if (res.headersSent) return

  // Handle Zod validation errors with a 400 status
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Invalid request body or parameters.',
      details: err.errors,
    })
  }

  const msg = typeof err?.message === 'string' ? err.message : ''

  // Make 500 actionable without leaking secrets.
  if (msg.includes('DATABASE_URL is not set')) {
    return res.status(500).json({ error: 'Internal server error', details: 'DATABASE_URL is not set' })
  }

  if (msg.includes('DATABASE_URL') && msg.includes('required')) {
    return res.status(500).json({ error: 'Internal server error', details: msg })
  }

  // Specific check for the SSL error you're seeing. This makes it obvious.
  if (msg.includes('The server does not support SSL connections')) {
    return res.status(500).json({
      error: 'Internal server error',
      details: 'Database connection failed: The server does not support SSL. Check backend/.env and db/index.ts configuration.'
    })
  }

  if (isPgError(err)) {
    // For database errors, provide the detail/hint from the error if available.
    // This is safe as it doesn't leak connection details or stack traces.
    console.error(`PostgreSQL Error: [${err.code ?? 'N/A'}] (${err.severity ?? 'N/A'})`, err.message)
    const details = err?.detail ?? err?.hint ?? err?.message
    return res.status(500).json({
      error: 'Internal server error',
      details: typeof details === 'string' ? details : 'A database error occurred.'
    })
  }

  // Anthropic SDK errors carry a `status` (HTTP status code from the API)
  // and often an `error.error.message` with the real reason (e.g. invalid
  // API key, rate limit, etc). Surface these instead of letting them fall
  // through to Express's default HTML error page.
  const anthropicStatus = typeof err?.status === 'number' ? err.status : undefined
  if (anthropicStatus) {
    const anthropicMsg =
      err?.error?.error?.message ??
      err?.error?.message ??
      msg ??
      'AI service request failed.'

    if (anthropicStatus === 401) {
      return res.status(500).json({
        error: 'Internal server error',
        details: 'The AI service rejected the API key (authentication failed). Check ANTHROPIC_API_KEY in Backend/.env.'
      })
    }

    return res.status(500).json({
      error: 'Internal server error',
      details: anthropicMsg
    })
  }

  // A generic 404 may be thrown by Express if no route matches.
  // This makes sure we always respond with JSON.
  if (err.status === 404 || msg.toLowerCase().includes('not found')) {
    return res.status(404).json({
      error: 'Not Found',
      details: msg || `Cannot ${_req.method} ${_req.path}`,
    })
  }
  // Fallback: always respond with JSON so the frontend can parse it,
  // instead of passing to next(err) and letting Express render an HTML page.
  console.error(err)
  return res.status(500).json({
    error: 'Internal server error',
    details: msg || 'An unexpected error occurred.'
  })
}
