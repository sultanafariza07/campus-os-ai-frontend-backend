import { Router } from 'express'
import { query } from '../db/index.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { z } from 'zod'

export const notificationsRouter = Router()

notificationsRouter.use(requireAuth)

const NotificationType = z.enum(['task', 'note', 'ai', 'general'])

const NotificationSchema = z.object({
  id: z.number(),
  type: NotificationType,
  title: z.string(),
  message: z.string().nullable(),
  read: z.boolean(),
  createdAt: z.string(),
})

// GET /api/notifications?limit=50&type=task&unread=true
notificationsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const requestedLimit = Number(req.query.limit)
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 && requestedLimit <= 100 ? requestedLimit : 50

    const type = NotificationType.optional().parse(req.query.type)
    const unreadOnly = z.boolean().optional().parse(req.query.unread === 'true' ? true : undefined)

    const conditions = ['user_id = $1']
    const params: unknown[] = [userId]

    if (type) {
      params.push(type)
      conditions.push(`type = $${params.length}`)
    }
    if (unreadOnly === true) {
      conditions.push('is_read = false')
    }

    params.push(limit)

    const rows = await query<z.infer<typeof NotificationSchema>>(
      `SELECT id, type, title, message, is_read AS read, created_at AS "createdAt"
       FROM notifications
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params
    )
    return res.json({ notifications: rows })
  })
)

// GET /api/notifications/unread-count
notificationsRouter.get(
  '/unread-count',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const rows = await query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    )
    return res.json({ count: rows[0]?.count ?? 0 })
  })
)

// PATCH /api/notifications/read-all
notificationsRouter.patch(
  '/read-all',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const rows = await query<{ id: number }>(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false RETURNING id',
      [userId]
    )
    return res.json({ updated: rows.length })
  })
)

// POST /api/notifications
// Mainly useful for testing/manual notifications — real ones are also
// created internally by tasks/notes routes via lib/notifications.ts.
notificationsRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const CreateNotificationPayload = z.object({
      title: z.string().trim().min(1, 'title is required').max(255),
      message: z.string().trim().optional(),
      type: NotificationType.optional().default('general'),
    })
    const parsed = CreateNotificationPayload.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }
    const { title, message, type } = parsed.data

    const rows = await query<z.infer<typeof NotificationSchema>>(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, type, title, message, is_read AS read, created_at AS "createdAt"`,
      [userId, type, title, message || null]
    )
    return res.status(201).json({ notification: rows[0] })
  })
)

// PATCH /api/notifications/:id/read
notificationsRouter.patch(
  '/:id/read',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' })

    const rows = await query<z.infer<typeof NotificationSchema>>(
      `UPDATE notifications SET is_read = true
       WHERE id = $1 AND user_id = $2
       RETURNING id, type, title, message, is_read AS read, created_at AS "createdAt"`,
      [id, userId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'notification not found' })
    return res.json({ notification: rows[0] })
  })
)

// DELETE /api/notifications/:id
notificationsRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' })

    const result = await query<{ id: number }>(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    )

    if (result.length === 0) return res.status(404).json({ error: 'notification not found' })
    return res.status(204).send()
  })
)
