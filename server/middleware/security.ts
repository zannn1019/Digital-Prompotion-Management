// Security headers for every response; a same-origin check and a size limit for API writes.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// No inline scripts by default; HTML pages get hashes of their own inline scripts (server/plugins/csp.ts).
const CSP = cspHeader()

export default defineEventHandler(event => {
  // The visitor's address, for a server-rendered page to pass on to its own API call (app/pages/k/[code].vue).
  event.context.clientIp = clientIp(event)
  setResponseHeaders(event, {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  })
  // Vite's dev server needs eval and websockets, so the CSP only applies to builds.
  if (!import.meta.dev) {
    setResponseHeader(event, 'Content-Security-Policy', CSP)
    setResponseHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  if (event.path.startsWith('/api/') && !SAFE_METHODS.has(event.method)) {
    // CSRF defence in depth (cookies are already SameSite=Lax): API writes must come from this origin.
    // The site's own host comes from NUXT_PUBLIC_SITE_URL when set; X-Forwarded-Host only counts behind a trusted proxy.
    const config = useRuntimeConfig(event)
    const origin = getRequestHeader(event, 'origin')
    const host = originHost(config.public.siteUrl) ?? getRequestHost(event, { xForwardedHost: !!config.trustProxy })
    if (origin && originHost(origin) !== host) throw createError({ statusCode: 403, statusMessage: 'Permintaan ditolak.' })

    // Refuse oversized bodies before they are read into memory.
    const tooBig = bodySizeError(event.path, getRequestHeader(event, 'content-length'), getRequestHeader(event, 'transfer-encoding'))
    if (tooBig === 411) throw createError({ statusCode: 411, statusMessage: 'Ukuran data tidak diketahui.' })
    if (tooBig === 413)
      throw createError({
        statusCode: 413,
        statusMessage: event.path.startsWith('/api/uploads')
          ? 'Ukuran file melebihi 5 MB. Perkecil ukuran gambar lalu unggah ulang.'
          : 'Data yang dikirim terlalu besar.',
      })
  }
})
