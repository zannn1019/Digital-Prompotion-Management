// Liveness check for Docker and the proxy: answers when the server can handle requests.
// No login, no data, nothing that changes; never cached.
export default defineEventHandler(event => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { ok: true }
})
