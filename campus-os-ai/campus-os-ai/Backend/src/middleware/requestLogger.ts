import type { Request, Response, NextFunction } from 'express'

// Simple structured request log: method, path, status, duration.
// Intentionally dependency-free (no morgan/pino) — this project has no
// logging library installed, and pulling one in isn't worth it for a
// single-line-per-request need.
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()

  res.on('finish', () => {
    const ms = Date.now() - start
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`

    if (res.statusCode >= 500) console.error(line)
    else if (res.statusCode >= 400) console.warn(line)
    else console.log(line)
  })

  next()
}
