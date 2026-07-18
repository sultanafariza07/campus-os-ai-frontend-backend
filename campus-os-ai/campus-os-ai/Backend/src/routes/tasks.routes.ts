import { Router } from 'express'
import { query } from '../db/index.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { createNotification } from '../lib/notifications.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const tasksRouter = Router()

tasksRouter.use(requireAuth)

tasksRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const rows = await query<any>(
      'SELECT id, title, due_date AS dueDate, completed FROM tasks WHERE user_id=$1 ORDER BY id DESC',
      [userId]
    )
    return res.json({ tasks: rows })
  })
)

tasksRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const { title, due_date, completed } = req.body as {
      title?: string
      due_date?: string
      completed?: boolean
    }

    if (!title?.trim()) return res.status(400).json({ error: 'title is required' })
    if (title.trim().length > 255) return res.status(400).json({ error: 'title must be 255 characters or fewer' })
    if (due_date !== undefined && due_date !== null && Number.isNaN(new Date(due_date).getTime())) {
      return res.status(400).json({ error: 'due_date must be a valid date' })
    }

    const due = due_date ? String(due_date) : null
    const rows = await query<any>(
      'INSERT INTO tasks (title, due_date, completed, user_id) VALUES ($1, $2, COALESCE($3,false), $4) RETURNING id, title, due_date AS dueDate, completed',
      [title.trim(), due, typeof completed === 'boolean' ? completed : false, userId]
    )

    await createNotification(userId, 'task', 'New task added', `"${rows[0].title}" was added to your tasks.`)

    return res.status(201).json({ task: rows[0] })
  })
)

tasksRouter.put(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const taskId = Number(req.params.id)
    if (!Number.isFinite(taskId)) return res.status(400).json({ error: 'invalid id' })

    const { title, due_date, completed } = req.body as {
      title?: string
      due_date?: string
      completed?: boolean
    }

    if (title !== undefined && !title.trim()) {
      return res.status(400).json({ error: 'title cannot be empty' })
    }
    if (due_date !== undefined && due_date !== null && Number.isNaN(new Date(due_date).getTime())) {
      return res.status(400).json({ error: 'due_date must be a valid date' })
    }

    const rows = await query<any>(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           due_date = COALESCE($2, due_date),
           completed = COALESCE($3, completed)
       WHERE id=$4 AND user_id=$5
       RETURNING id, title, due_date AS dueDate, completed`,
      [title?.trim() ?? null, due_date ?? null, typeof completed === 'boolean' ? completed : null, taskId, userId]
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

    await query('DELETE FROM tasks WHERE id=$1 AND user_id=$2', [taskId, userId])
    return res.status(204).send()
  })
)
