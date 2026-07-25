import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db/index.js'
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
    let query = db
      .selectFrom("attendance")
      .where("user_id", "=", req.user!.id)
      .selectAll()
      .orderBy("date", "desc");
    if (limit) {
      query = query.limit(limit);
    }
    const records = await query.execute();
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
    const [newRecord] = await db
      .insertInto("attendance")
      .values({ user_id: req.user!.id, date, subject, status })
      .returningAll()
      .execute();
    res.status(201).json({ attendance: newRecord });
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

    const [updatedRecord] = await db
      .updateTable("attendance")
      .set(body)
      .where("id", "=", id)
      .where("user_id", "=", req.user!.id)
      .returningAll()
      .execute();

    if (!updatedRecord) {
      return res.status(404).json({
        error:
          "Attendance record not found or you do not have permission to update it.",
      });
    }
    res.json({ attendance: updatedRecord });
  })
);

// 4. Delete an attendance record
attendanceRoutes.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const result = await db.deleteFrom("attendance").where("id", "=", id).where("user_id", "=", req.user!.id).executeTakeFirst();
    if (result.numDeletedRows === 0n) {
      return res.status(404).json({ error: "Attendance record not found or you do not have permission to delete it." });
    }
    res.status(204).send();
  })
);