import { Router } from 'express'
import { query } from '../db/index.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { createNotification } from '../lib/notifications.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { z } from 'zod'

export const notesRouter = Router()

notesRouter.use(requireAuth)

const NoteSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string().nullable(),
  updatedAt: z.string(),
})

const NotePayload = z.object({
  title: z.string().trim().min(1, 'title is required').max(255),
  content: z.string().trim().optional(),
})

notesRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const rows = await query<z.infer<typeof NoteSchema>>(
      'SELECT id, title, content, updated_at AS updatedAt FROM notes WHERE user_id=$1 ORDER BY updated_at DESC',
      [userId]
    )
    return res.json({ notes: rows })
  })
)

notesRouter.get(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const noteId = Number(req.params.id)
    if (!Number.isFinite(noteId)) return res.status(400).json({ error: 'invalid id' })

    const rows = await query<z.infer<typeof NoteSchema>>(
      'SELECT id, title, content, updated_at AS updatedAt FROM notes WHERE id=$1 AND user_id=$2',
      [noteId, userId]
    )

    if (!rows[0]) return res.status(404).json({ error: 'note not found' })
    return res.json({ note: rows[0] })
  })
)

// POST /api/notes (create)
notesRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const parsed = NotePayload.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }
    const { title, content } = parsed.data

    const rows = await query<z.infer<typeof NoteSchema>>(
      'INSERT INTO notes (title, content, user_id) VALUES ($1, $2, $3) RETURNING id, title, content, updated_at AS "updatedAt"',
      [title, content ?? '', userId]
    )

    await createNotification(userId, 'note', 'New note created', `"${rows[0].title}" was saved to your notes.`)

    return res.status(201).json({ note: rows[0] })
  })
)

const UpdateNotePayload = NotePayload.partial()

// PUT /api/notes/:id (update)
notesRouter.put(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const noteId = Number(req.params.id)
    if (!Number.isFinite(noteId)) return res.status(400).json({ error: 'invalid id' })

    const parsed = UpdateNotePayload.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message })
    }
    if (Object.keys(parsed.data).length === 0) {
      return res.status(400).json({ error: 'at least one field to update must be provided' })
    }
    const { title, content } = parsed.data

    const rows = await query<z.infer<typeof NoteSchema>>(
      'UPDATE notes SET title=COALESCE($1, title), content=COALESCE($2, content), updated_at=NOW() WHERE id=$3 AND user_id=$4 RETURNING id, title, content, updated_at AS "updatedAt"',
      [title ?? null, content ?? null, noteId, userId]
    )

    if (!rows[0]) return res.status(404).json({ error: 'note not found' })
    return res.json({ note: rows[0] })
  })
)

notesRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const noteId = Number(req.params.id)
    if (!Number.isFinite(noteId)) return res.status(400).json({ error: 'invalid id' })

    const result = await query<{ id: number }>(
      'DELETE FROM notes WHERE id=$1 AND user_id=$2 RETURNING id',
      [noteId, userId]
    )

    if (result.length === 0) return res.status(404).json({ error: 'note not found' })
    return res.status(204).send()
  })
)
