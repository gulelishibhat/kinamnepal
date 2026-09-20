import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '../../../..');
const appEnv = process.env['APP_ENV'] ?? 'local';
// Load env-specific file first (e.g. .env.production), then base .env as fallback.
config({ path: resolve(rootDir, `.env.${appEnv}`) });
config({ path: resolve(rootDir, '.env') });

const { Pool } = pg;

// RDS requires SSL. Local Postgres doesn't — enable SSL only for remote hosts.
const dbUrl = process.env['DATABASE_URL'] ?? '';
const isRemote = !/@(localhost|127\.0\.0\.1)/.test(dbUrl);

async function runMigrations() {
  const pool = new Pool({
    connectionString: dbUrl,
    ...(isRemote ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  const db = drizzle(pool);

  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: resolve(__dirname, 'migrations') });
  console.log('Migrations complete.');

  await pool.end();
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
