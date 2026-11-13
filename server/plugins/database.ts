// Connects to PostgreSQL at start-up and applies pending migrations, so a broken database setup
// shows up in the log right away instead of on the first request.
export default defineNitroPlugin(() => {
  if (!databaseConfigured()) {
    console.warn('[db] NUXT_DATABASE_URL is not set: data is kept in memory and lost on restart.')
    return
  }
  initDatabase()
    .ready.then(() => console.info('[db] Database ready (migrations applied).'))
    .catch(err => console.error('[db] Database setup failed:', err instanceof Error ? err.message : err))
})
