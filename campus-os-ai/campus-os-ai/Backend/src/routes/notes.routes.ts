import { Router } from 'express'
import { query } from '../db/index.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const notesRouter = Router()

// GET /api/notes
notesRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const rows = await query(
      'SELECT id, title, content, updated_at FROM notes WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    )
    res.json({ notes: rows })
  })
)

// GET /api/notes/:id
notesRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const { id } = req.params
    const rows = await query(
      'SELECT id, title, content, updated_at FROM notes WHERE id = $1 AND user_id = $2',
      [id, userId]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'note not found' })
    res.json({ note: rows[0] })
  })
)

// POST /api/notes
notesRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const { title, content } = req.body as { title?: string; content?: string }

    if (!title?.trim()) return res.status(400).json({ error: 'title is required' })

    const rows = await query(
      'INSERT INTO notes (user_id, title, content) VALUES ($1, $2, $3) RETURNING id, title, content, updated_at',
      [userId, title.trim(), content ?? '']
    )
    res.status(201).json({ note: rows[0] })
  })
)

// PUT /api/notes/:id
notesRouter.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const { id } = req.params
    const { title, content } = req.body as { title?: string; content?: string }

    if (title !== undefined && !title.trim()) {
      return res.status(400).json({ error: 'title cannot be empty' })
    }

    const rows = await query(
      `UPDATE notes
       SET title = COALESCE($1, title), content = COALESCE($2, content), updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING id, title, content, updated_at`,
      [title?.trim(), content, id, userId]
    )

    if (rows.length === 0) return res.status(404).json({ error: 'note not found' })
    res.json({ note: rows[0] })
  })
)

// DELETE /api/notes/:id
notesRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const { id } = req.params
    const result = await query<{ id: number }>(
      'DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    )
    if (result.length === 0) return res.status(404).json({ error: 'note not found' })
    res.status(204).send()
  })
)