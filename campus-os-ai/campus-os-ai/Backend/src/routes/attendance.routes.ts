import { Router } from 'express'
import { query } from '../db/index.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const attendanceRouter = Router()

attendanceRouter.use(requireAuth)





// GET /api/attendance
attendanceRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const rows = await query<any>(
      'SELECT id, date, subject, status, created_at AS "createdAt" FROM attendance WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
      [userId]
    )
    res.json({ attendance: rows })
  })
)

// POST /api/attendance
attendanceRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const { date, subject, status } = req.body as { date?: string; subject?: string; status?: string }

    if (!date?.trim() || !subject?.trim() || !status?.trim()) {
      return res.status(400).json({ error: 'date, subject, and status are required and cannot be empty' })
    }
    if (Number.isNaN(new Date(date).getTime())) {
      return res.status(400).json({ error: 'date must be a valid date' })
    }
    if (!['Present', 'Absent', 'Late'].includes(status)) {
      return res.status(400).json({ error: 'status must be one of "Present", "Absent", or "Late"' })
    }

    const rows = await query<any>(
      'INSERT INTO attendance (user_id, date, subject, status) VALUES ($1, $2, $3, $4) RETURNING id, date, subject, status, created_at AS "createdAt"',
      [userId, date, subject, status]
    )
    res.status(201).json({ attendance: rows[0] })
  })
)

// PUT /api/attendance/:id
attendanceRouter.put(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const { id } = req.params
    const attendanceId = Number(id)
    if (!Number.isFinite(attendanceId)) return res.status(400).json({ error: 'invalid id' })
    const { date, subject, status } = req.body as { date?: string; subject?: string; status?: string }

    if (date !== undefined && (date === null || Number.isNaN(new Date(date).getTime()))) {
      return res.status(400).json({ error: 'date must be a valid date' })
    }
    if (status !== undefined && (status === null || !['Present', 'Absent', 'Late'].includes(status))) {
      return res.status(400).json({ error: 'status must be one of "Present", "Absent", or "Late"' })
    }
    if (subject !== undefined && subject !== null && !subject.trim()) {
      return res.status(400).json({ error: 'subject cannot be empty' })
    }
    const rows = await query<any>(
      `UPDATE attendance SET
         date = COALESCE($1, date),
         subject = COALESCE($2, subject),
         status = COALESCE($3, status)
       WHERE id = $4 AND user_id = $5 
       RETURNING id, date, subject, status, created_at AS "createdAt"`,
      [date, subject?.trim(), status, attendanceId, userId]
    )

    if (rows.length === 0) return res.status(404).json({ error: 'Attendance record not found' })
    res.json({ attendance: rows[0] })
  })
)

// DELETE /api/attendance/:id
attendanceRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const { id } = req.params
    const attendanceId = Number(id)
    if (!Number.isFinite(attendanceId)) return res.status(400).json({ error: 'invalid id' })

    // query() returns rows[] (empty for DELETE), so use a simple existence check approach
    const rows = await query<any>('DELETE FROM attendance WHERE id = $1 AND user_id = $2 RETURNING id', [attendanceId, userId])
    if (rows.length === 0) return res.status(404).json({ error: 'Attendance record not found' })
    res.status(204).send()
  })
)

