// Drizzle Kit: `npm run db:generate` turns changes in server/db/schema.ts into a SQL migration.
// Migrations are applied by the app itself at start-up (server/plugins/database.ts).
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dbCredentials: { url: process.env.NUXT_DATABASE_URL ?? 'postgres://poster:poster@127.0.0.1:5432/poster_nfc' },
  strict: true,
  verbose: true,
})
