import { Router } from 'express'
import { query } from '../db/index.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const attendanceRouter = Router()

attendanceRouter.use(requireAuth)

// GET /api/attendance?limit=3
attendanceRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const limit = Number(req.query.limit) || 30

    const rows = await query<any>(
      'SELECT id, date, subject, status FROM attendance WHERE user_id=$1 ORDER BY date DESC, id DESC LIMIT $2',
      [userId, limit]
    )
    return res.json({ attendance: rows })
  })
)

// POST /api/attendance  -> mark a subject present/absent for today
attendanceRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const { subject, status } = req.body as { subject?: string; status?: 'present' | 'absent' }

    if (!subject?.trim()) return res.status(400).json({ error: 'subject is required' })
    if (status !== 'present' && status !== 'absent') {
      return res.status(400).json({ error: "status must be 'present' or 'absent'" })
    }

    const rows = await query<any>(
      `INSERT INTO attendance (user_id, date, subject, status)
       VALUES ($1, CURRENT_DATE, $2)
       ON CONFLICT (user_id, date, subject)
       DO UPDATE SET status = EXCLUDED.status
       RETURNING id, date, subject, status`,
      [userId, subject.trim(), status]
    )

    return res.status(201).json({ attendance: rows[0] })
  })
)