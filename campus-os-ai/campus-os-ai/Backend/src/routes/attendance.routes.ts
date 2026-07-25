import { Router } from 'express'
import { query } from '../db/index.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { z } from 'zod'

export const attendanceRouter = Router()

attendanceRouter.use(requireAuth)

const AttendanceStatus = z.enum(['Present', 'Absent', 'Late'])

const AttendanceRecordSchema = z.object({
  id: z.number(),
  date: z.string(),
  subject: z.string(),
  status: AttendanceStatus,
  createdAt: z.string(),
})

const CreateAttendancePayload = z.object({
  date: z.string().datetime({ message: 'date must be a valid date' }),
  subject: z.string().trim().min(1, 'subject is required'),
  status: AttendanceStatus,
})

// GET /api/attendance
attendanceRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const rows = await query<z.infer<typeof AttendanceRecordSchema>>(
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
    const parsed = CreateAttendancePayload.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }
    const { date, subject, status } = parsed.data

    const rows = await query<z.infer<typeof AttendanceRecordSchema>>(
      'INSERT INTO attendance (user_id, date, subject, status) VALUES ($1, $2, $3, $4) RETURNING id, date, subject, status, created_at AS "createdAt"',
      [userId, date, subject, status]
    )
    res.status(201).json({ attendance: rows[0] })
  })
)

const UpdateAttendancePayload = CreateAttendancePayload.partial()

// PUT /api/attendance/:id
attendanceRouter.put(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const attendanceId = Number(req.params.id)
    if (!Number.isFinite(attendanceId)) return res.status(400).json({ error: 'invalid id' })

    const parsed = UpdateAttendancePayload.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }
    const { date, subject, status } = parsed.data

    const rows = await query<z.infer<typeof AttendanceRecordSchema>>(
      `UPDATE attendance SET date = COALESCE($1, date), subject = COALESCE($2, subject), status = COALESCE($3, status)
       WHERE id = $4 AND user_id = $5 
       RETURNING id, date, subject, status, created_at AS "createdAt"`,
      [date, subject, status, attendanceId, userId]
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
    const attendanceId = Number(req.params.id)
    if (!Number.isFinite(attendanceId)) {
      return res.status(400).json({ error: 'invalid id' })
    }

    const result = await query<{ id: number }>(
      'DELETE FROM attendance WHERE id = $1 AND user_id = $2 RETURNING id',
      [attendanceId, userId]
    )

    if (result.length === 0) return res.status(404).json({ error: 'Attendance record not found' })
    res.status(204).send()
  })
)