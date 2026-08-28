import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

import { config } from './config.js'
import { authRouter } from './routes/auth.routes.js'
import { attendanceRouter } from './routes/attendance.js'
import { notesRouter } from './routes/notes.routes.js'
import { tasksRouter } from './routes/tasks.routes.js'
import { aiRouter } from './routes/chat.js'
import { notificationsRouter } from './routes/notifications.routes.js'
import { requestLogger } from './middleware/requestLogger.js'
import { notFound } from './middleware/notFound.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()

app.use(helmet({
  // Sensible defaults for an API server (no HTML pages served here beyond
  // the root status message), plus the usual security headers helmet
  // already applies (X-Content-Type-Options, X-Frame-Options, etc).
  crossOriginResourcePolicy: { policy: 'same-site' },
}))

const allowedOrigins = [
  'http://localhost:5173', // Local dev frontend
  'https://campus-os-ai-frontend-backend.vercel.app', // Stable production Vercel domain
  config.CORS_ORIGIN, // Keep support for the environment variable
].filter(Boolean) as string[]

// Vercel gives every preview deployment a new random-suffixed URL
// (e.g. campus-os-ai-frontend-backend-8nhoi4wqa.vercel.app). Rather than
// hardcoding each one (which goes stale on every deploy), match any
// preview URL that belongs to this project by pattern.
const vercelPreviewPattern = /^https:\/\/campus-os-ai-frontend-backend-[a-z0-9]+\.vercel\.app$/

app.use(cors({
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    // Allow non-browser clients (e.g., curl, Render health checks) that don't send an Origin header.
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    if (vercelPreviewPattern.test(origin)) return cb(null, true)
    return cb(new Error(`CORS policy does not allow access from origin ${origin}`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))
app.use(requestLogger)

app.get('/health', (_req: express.Request, res: express.Response) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)
app.use('/api/notes', notesRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/ai', aiRouter)
app.use('/api/attendance', attendanceRouter)

app.get('/', (_req: express.Request, res: express.Response) => {
  res.json({
    message: 'CampusOS AI Backend Running 🚀',
  })
})

app.use(notFound)
app.use(errorHandler)

app.listen(config.PORT, () => {
  console.log(`CampusOS AI Backend listening on http://localhost:${config.PORT}`)
})