import { Router } from 'express'
import { query } from '../db/index.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const attendanceRouter = Router()

attendanceRouter.use(requireAuth)

// GET /api/attendance?limit=3  -> list recent attendance records
attendanceRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const limit = Number(req.query.limit) || 30

    const rows = await query<any>(
      'SELECT id, date, present FROM attendance WHERE user_id=$1 ORDER BY date DESC LIMIT $2',
      [userId, limit]
    )
    return res.json({ attendance: rows })
  })
)

// POST /api/attendance  -> mark present/absent for today
attendanceRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const { present } = req.body as { present?: boolean }

    if (typeof present !== 'boolean') {
      return res.status(400).json({ error: 'present must be true or false' })
    }

    const rows = await query<any>(
      `INSERT INTO attendance (user_id, date, present)
       VALUES ($1, CURRENT_DATE, $2)
       ON CONFLICT (user_id, date)
       DO UPDATE SET present = EXCLUDED.present
       RETURNING id, date, present`,
      [userId, present]
    )

    return res.status(201).json({ attendance: rows[0] })
  })
)