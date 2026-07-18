import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '..', 'src', 'db', 'schema.sql');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl.includes('USER:PASSWORD')) {
  console.error(
    'DATABASE_URL is missing or still a placeholder. Set a real connection string in Backend/.env before running db:setup.'
  );
  process.exit(1);
}

console.log(`Running schema against: ${databaseUrl.replace(/:[^:@]*@/, ':****@')}`);

const result = spawnSync('psql', [databaseUrl, '-f', schemaPath], {
  stdio: 'inherit',
});

if (result.error) {
  console.error('Failed to run psql. Is PostgreSQL installed and on your PATH?');
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);