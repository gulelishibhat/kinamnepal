/**
 * Seed script — creates the first admin account and sample categories.
 * Run once: pnpm db:seed
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import bcrypt from 'bcrypt';
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

async function seed() {
  const pool = new Pool({
    connectionString: dbUrl,
    ...(isRemote ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  const db = drizzle(pool, { schema });

  // ── Admin account ────────────────────────────────────────────────────────
  const email = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@mkelectric.com';
  const password = process.env['SEED_ADMIN_PASSWORD'] ?? 'Admin@12345';
  const name = process.env['SEED_ADMIN_NAME'] ?? 'Admin';

  const existing = await db.query.admins.findFirst({
    where: (a, { eq }) => eq(a.email, email),
  });

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.insert(schema.admins).values({ name, email, passwordHash });
    console.log(`✅ Admin created: ${email}`);
  } else {
    console.log(`ℹ️  Admin already exists: ${email}`);
  }

  // ── Sample categories ────────────────────────────────────────────────────
  const sampleCategories = [
    { nameEn: 'Wiring & Cables', nameNe: 'तार र केबल', slug: 'wiring-cables', sortOrder: 1 },
    { nameEn: 'Switches & Sockets', nameNe: 'स्विच र सकेट', slug: 'switches-sockets', sortOrder: 2 },
    { nameEn: 'Lighting', nameNe: 'लाइटिङ', slug: 'lighting', sortOrder: 3 },
    { nameEn: 'Distribution Boards', nameNe: 'वितरण बोर्ड', slug: 'distribution-boards', sortOrder: 4 },
    { nameEn: 'Conduits & Fittings', nameNe: 'कन्ड्युट र फिटिङ', slug: 'conduits-fittings', sortOrder: 5 },
    { nameEn: 'Tools & Accessories', nameNe: 'औजार र सहायक', slug: 'tools-accessories', sortOrder: 6 },
  ];

  for (const cat of sampleCategories) {
    const exists = await db.query.categories.findFirst({
      where: (c, { eq }) => eq(c.slug, cat.slug),
    });
    if (!exists) {
      await db.insert(schema.categories).values(cat);
      console.log(`✅ Category created: ${cat.nameEn}`);
    }
  }

  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
