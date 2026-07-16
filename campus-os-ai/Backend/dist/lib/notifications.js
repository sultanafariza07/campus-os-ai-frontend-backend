import { query } from '../db/index.js';
/**
 * Creates a notification for a user. Failures here are logged but never
 * thrown — a notification is a secondary effect of some other action (task
 * created, note saved, etc.) and must never cause that primary action to
 * fail or roll back.
 */
export async function createNotification(userId, type, title, message) {
    try {
        await query('INSERT INTO notifications (user_id, type, title, message) VALUES ($1, $2, $3, $4)', [userId, type, title, message ?? null]);
    }
    catch (err) {
        console.error('createNotification failed:', err);
    }
}
