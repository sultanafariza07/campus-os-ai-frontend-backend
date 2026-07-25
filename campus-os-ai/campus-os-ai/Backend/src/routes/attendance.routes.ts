import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/index.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const attendanceRoutes = Router()

attendanceRoutes.use(requireAuth)

// 1. List all attendance records for the logged-in user
const ListQuery = z.object({
  limit: z.coerce.number().int().positive().optional(),
})

attendanceRoutes.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const { limit } = ListQuery.parse(req.query);
    const userId = req.user!.id;

    let sql = 'SELECT id, user_id, date, subject, status, created_at AS "createdAt" FROM attendance WHERE user_id = $1 ORDER BY date DESC';
    const params: unknown[] = [userId];

    if (limit) {
      sql += ` LIMIT $2`;
      params.push(limit);
    }

    const records = await query(sql, params);
    res.json({ attendance: records });
  })
);

// 2. Create a new attendance record
const CreateBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // 'YYYY-MM-DD'
  subject: z.string().min(1).max(255),
  status: z.enum(['Present', 'Absent', 'Late']),
})

attendanceRoutes.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const { date, subject, status } = CreateBody.parse(req.body);
    const userId = req.user!.id;

    const [newRecord] = await query(
      'INSERT INTO attendance (user_id, date, subject, status) VALUES ($1, $2, $3, $4) RETURNING id, user_id, date, subject, status, created_at AS "createdAt"',
      [userId, date, subject, status]
    );
    res.status(201).json({ attendance: newRecord! });
  })
);

// 3. Update an existing attendance record
const UpdateBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  subject: z.string().min(1).max(255).optional(),
  status: z.enum(['Present', 'Absent', 'Late']).optional(),
})

attendanceRoutes.put(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const body = UpdateBody.parse(req.body);

    if (Object.keys(body).length === 0) {
      return res
        .status(400)
        .json({ error: "At least one field to update must be provided." });
    }

    const userId = req.user!.id;
    const { date, subject, status } = body;

    const [updatedRecord] = await query(
      `UPDATE attendance
       SET date = COALESCE($1, date),
           subject = COALESCE($2, subject),
           status = COALESCE($3, status)
       WHERE id = $4 AND user_id = $5
       RETURNING id, user_id, date, subject, status, created_at AS "createdAt"`,
      [date, subject, status, id, userId]
    );

    if (!updatedRecord) {
      return res.status(404).json({
        error:
          "Attendance record not found or you do not have permission to update it.",
      });
    }
    res.json({ attendance: updatedRecord! });
  })
);

// 4. Delete an attendance record
attendanceRoutes.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const userId = req.user!.id;

    const result = await query('DELETE FROM attendance WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);

    if (result.length === 0) {
      return res.status(404).json({ error: "Attendance record not found or you do not have permission to delete it." });
    }
    res.status(204).send();
  })
);