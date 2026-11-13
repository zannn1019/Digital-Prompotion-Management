// PostgreSQL connection with Drizzle. Plain Node code (no Nuxt imports), so it works in any backend.
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'

export type Database = NodePgDatabase<typeof schema>

export function createDatabase(url: string) {
  // A small pool is plenty for one app container; Postgres allows 100 connections by default.
  const pool = new pg.Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 })
  pool.on('error', err => console.error('[db] idle connection error:', err.message))
  return { db: drizzle(pool, { schema }), pool }
}
