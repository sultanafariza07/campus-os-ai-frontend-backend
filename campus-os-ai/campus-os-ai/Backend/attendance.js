const express = require('express');

const router = express.Router();

// In-memory store for demo purposes. Replace with database logic.
const attendanceRecords = [
    { id: 1, userId: 1, date: '2024-07-20T00:00:00.000Z', status: 'present', subject: 'Data Structures' },
    { id: 2, userId: 1, date: '2024-07-19T00:00:00.000Z', status: 'absent', subject: 'Algorithms' },
    { id: 3, userId: 1, date: '2024-07-18T00:00:00.000Z', status: 'present', subject: 'Database Systems' },
];
let nextId = 4;

/**
 * GET /api/attendance
 * Lists all attendance records for the user.
 */
router.get('/', (req, res) => {
    // In a real app, you'd get the userId from the JWT token.
    // const userId = req.user.id;
    // const userRecords = attendanceRecords.filter(r => r.userId === userId);
    res.json({ attendance: attendanceRecords });
});

/**
 * POST /api/attendance/today
 * Marks attendance for the current day.
 */
router.post('/today', (req, res) => {
    const { present } = req.body;
    const today = new Date().toISOString().split('T')[0];

    // Remove any existing record for today
    const existingIndex = attendanceRecords.findIndex(r => r.date.startsWith(today));
    if (existingIndex !== -1) {
        attendanceRecords.splice(existingIndex, 1);
    }

    const newRecord = { id: nextId++, userId: 1, date: new Date().toISOString(), status: present ? 'present' : 'absent', subject: 'New Subject' };
    attendanceRecords.unshift(newRecord); // Add to the beginning
    res.status(201).json({ attendance: newRecord });
});

module.exports = router;