import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/attendance
 * Lists all attendance records for the authenticated user.
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM attendance WHERE user_id = $1 ORDER BY date DESC',
      [userId]
    );
    res.json({ attendance: result.rows });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ error: 'Failed to fetch attendance records.' });
  }
});

/**
 * POST /api/attendance/today
 * Marks attendance for the current day for the authenticated user.
 */
router.post('/today', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { present, subject } = req.body;

    if (typeof present !== 'boolean') {
      return res.status(400).json({ error: '`present` field (boolean) is required.' });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Use INSERT ... ON CONFLICT to either create a new record or update an existing one for the same day.
    // This is more robust than deleting and then inserting.
    const result = await pool.query(
      `INSERT INTO attendance (user_id, date, status, subject)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, date)
       DO UPDATE SET status = EXCLUDED.status, subject = EXCLUDED.subject, updated_at = NOW()
       RETURNING *`,
      [userId, today, present ? 'present' : 'absent', subject || 'General']
    );

    res.status(201).json({ attendance: result.rows[0] });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ error: 'Failed to mark attendance.' });
  }
});

export default router;