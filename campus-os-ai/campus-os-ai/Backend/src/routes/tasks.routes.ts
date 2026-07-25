import { Router } from 'express'
import { query } from '../db/index.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { createNotification } from '../lib/notifications.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { z } from 'zod'

export const tasksRouter = Router()

tasksRouter.use(requireAuth)

const TaskSchema = z.object({
  id: z.number(),
  title: z.string(),
  dueDate: z.string().nullable(),
  completed: z.boolean(),
})

const CreateTaskPayload = z.object({
  title: z.string().trim().min(1, 'title is required').max(255),
  due_date: z.string().datetime().optional().nullable(),
  completed: z.boolean().optional(),
})

tasksRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const rows = await query<z.infer<typeof TaskSchema>>(
      'SELECT id, title, due_date AS "dueDate", completed FROM tasks WHERE user_id=$1 ORDER BY id DESC',
      [userId]
    )
    return res.json({ tasks: rows })
  })
)

tasksRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const parsed = CreateTaskPayload.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }
    const { title, due_date, completed } = parsed.data

    const rows = await query<z.infer<typeof TaskSchema>>(
      'INSERT INTO tasks (title, due_date, completed, user_id) VALUES ($1, $2, COALESCE($3,false), $4) RETURNING id, title, due_date AS "dueDate", completed',
      [title, due_date ?? null, completed ?? false, userId]
    )

    await createNotification(userId, 'task', 'New task added', `"${rows[0].title}" was added to your tasks.`)

    return res.status(201).json({ task: rows[0] })
  })
)

const UpdateTaskPayload = CreateTaskPayload.partial()

tasksRouter.put(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const taskId = Number(req.params.id)
    if (!Number.isFinite(taskId)) return res.status(400).json({ error: 'invalid id' })
    
    const parsed = UpdateTaskPayload.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }
    if (Object.keys(parsed.data).length === 0) {
      return res.status(400).json({ error: 'at least one field to update must be provided' })
    }
    const { title, due_date, completed } = parsed.data
    const rows = await query<z.infer<typeof TaskSchema>>(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           due_date = COALESCE($2, due_date),
           completed = COALESCE($3, completed)
       WHERE id=$4 AND user_id=$5
       RETURNING id, title, due_date AS "dueDate", completed`,
      [title, due_date, completed, taskId, userId]
    )

    if (!rows[0]) return res.status(404).json({ error: 'task not found' })

    if (completed === true) {
      await createNotification(userId, 'task', 'Task completed', `You completed "${rows[0].title}".`)
    }

    return res.json({ task: rows[0] })
  })
)

tasksRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const taskId = Number(req.params.id)
    if (!Number.isFinite(taskId)) return res.status(400).json({ error: 'invalid id' })

    const result = await query<{ id: number }>(
      'DELETE FROM tasks WHERE id=$1 AND user_id=$2 RETURNING id',
      [taskId, userId]
    )

    if (result.length === 0) return res.status(404).json({ error: 'task not found' })
    return res.status(204).send()
  })
)
