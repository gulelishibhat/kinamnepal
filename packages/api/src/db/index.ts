import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import { env } from '../config/env.js';

const { Pool } = pg;

// RDS requires SSL; local Postgres does not. Enable SSL for remote hosts only.
const isRemoteDb = !/@(localhost|127\.0\.0\.1)/.test(env.DATABASE_URL);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ...(isRemoteDb ? { ssl: { rejectUnauthorized: false } } : {}),
});

export const db = drizzle(pool, { schema, logger: env.NODE_ENV === 'development' });

export type DB = typeof db;
