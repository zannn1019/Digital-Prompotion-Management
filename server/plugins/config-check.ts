// Checks deploy settings at start-up, so a bad value stops the server right away
// instead of failing every request later (the in-memory data is only loaded on first use).
export default defineNitroPlugin(() => {
  seedPassword(process.env.NUXT_SEED_PASSWORD)
})
