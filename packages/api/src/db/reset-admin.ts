/**
 * Reset the admin password to a known value.
 * Usage: APP_ENV=production NEW_ADMIN_PASSWORD='Admin@12345' \
 *        pnpm --filter @mkelectric/api exec tsx src/db/reset-admin.ts
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import * as schema from './schema.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '../../../..');
const appEnv = process.env['APP_ENV'] ?? 'local';
config({ path: resolve(rootDir, `.env.${appEnv}`) });
config({ path: resolve(rootDir, '.env') });

const { Pool } = pg;
const dbUrl = process.env['DATABASE_URL'] ?? '';
const isRemote = !/@(localhost|127\.0\.0\.1)/.test(dbUrl);

async function run() {
  const email = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@mkelectric.com';
  const newPassword = process.env['NEW_ADMIN_PASSWORD'] ?? 'Admin@12345';

  const pool = new Pool({
    connectionString: dbUrl,
    ...(isRemote ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  const db = drizzle(pool, { schema });

  const hash = await bcrypt.hash(newPassword, 12);
  const [updated] = await db
    .update(schema.admins)
    .set({ passwordHash: hash, updatedAt: new Date() })
    .where(eq(schema.admins.email, email))
    .returning();

  if (updated) {
    console.log(`✅ Password reset for admin: ${email}`);
  } else {
    console.log(`⚠️  No admin found with email: ${email}`);
  }
  await pool.end();
}

run().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
