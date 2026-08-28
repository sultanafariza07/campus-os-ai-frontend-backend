import { Router } from 'express';
import OpenAI from 'openai';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are CampusOS AI Assistant. Help students with: - Notes - Tasks - Attendance - Study planning - College-related questions. Give simple, accurate and helpful answers.`,
        },
        { role: 'user', content: message },
      ],
    });

    res.json({
      reply: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error('AI assistant error:', error);
    res.status(500).json({ error: 'AI assistant failed to respond.' });
  }
});

export default router;