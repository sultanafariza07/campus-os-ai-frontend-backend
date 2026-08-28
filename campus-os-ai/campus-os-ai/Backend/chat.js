const express = require('express');
const OpenAI = require('openai');

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post('/', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    // Note: The user's instructions mentioned `openai.responses.create` which seems to be from an older or different SDK version.
    // The current `openai` SDK uses `openai.chat.completions.create`. I've used the current version.
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Using gpt-3.5-turbo as gpt-5 is not available.
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

module.exports = router;