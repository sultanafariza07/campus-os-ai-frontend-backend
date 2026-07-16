import { Router } from 'express'
import { query } from '../db/index.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const notificationsRouter = Router()

notificationsRouter.use(requireAuth)

const ALLOWED_TYPES = ['task', 'note', 'ai', 'general']

// GET /api/notifications?limit=50&type=task&unread=true
notificationsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const requestedLimit = Number(req.query.limit)
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 && requestedLimit <= 100 ? requestedLimit : 50

    const type = typeof req.query.type === 'string' && ALLOWED_TYPES.includes(req.query.type) ? req.query.type : null
    const unreadOnly = req.query.unread === 'true'

    const conditions = ['user_id = $1']
    const params: unknown[] = [userId]

    if (type) {
      params.push(type)
      conditions.push(`type = $${params.length}`)
    }
    if (unreadOnly) {
      conditions.push('is_read = false')
    }

    params.push(limit)

    const rows = await query<any>(
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
    const { title, message, type } = req.body as { title?: string; message?: string; type?: string }

    if (!title?.trim()) return res.status(400).json({ error: 'title is required' })
    if (title.trim().length > 255) return res.status(400).json({ error: 'title must be 255 characters or fewer' })
    if (message !== undefined && typeof message !== 'string') {
      return res.status(400).json({ error: 'message must be a string' })
    }

    const safeType = ALLOWED_TYPES.includes(String(type)) ? String(type) : 'general'

    const rows = await query<any>(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, type, title, message, is_read AS read, created_at AS "createdAt"`,
      [userId, safeType, title.trim(), message?.trim() || null]
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

    const rows = await query<any>(
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

    await query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [id, userId])
    return res.status(204).send()
  })
)
