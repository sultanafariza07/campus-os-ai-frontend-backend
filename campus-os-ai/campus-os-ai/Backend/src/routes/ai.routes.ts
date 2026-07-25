import { Router } from 'express'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { createNotification } from '../lib/notifications.js'

export const aiRouter = Router()

aiRouter.use(requireAuth)

// This is a placeholder for the AI chat functionality.
// In a real implementation, this would call an AI service like Anthropic/OpenAI.
aiRouter.post(
  '/chat',
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id
    const { message } = req.body as { message?: string }

    if (!message?.trim()) {
      return res.status(400).json({ error: 'message is required' })
    }

    // Simulate an AI response.
    const aiResponse = `This is a simulated AI response to your message: "${message}". A real implementation would call an AI service.`

    await createNotification(userId, 'ai', 'AI Assistant', 'You received a new message from the AI assistant.')

    return res.json({
      reply: aiResponse,
    })
  })
)