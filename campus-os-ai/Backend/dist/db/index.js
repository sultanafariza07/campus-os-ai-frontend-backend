// PostgreSQL DB layer.
// Note: this project requires DATABASE_URL to be set.
import { Pool } from 'pg';
import { config } from '../config.js';
function mustGetDatabaseUrl() {
    if (!config.DATABASE_URL) {
        throw new Error('DATABASE_URL is not set. Create it (e.g., in .env) before starting the backend.');
    }
    return config.DATABASE_URL;
}
export const pool = new Pool({ connectionString: mustGetDatabaseUrl() });
export async function query(text, params = []) {
    const res = await pool.query(text, params);
    return res.rows;
}
