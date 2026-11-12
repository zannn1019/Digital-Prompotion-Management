/**
 * Absolute address of a card's poster page, for the "continue on your phone" QR code.
 * It comes from the configured site address (NUXT_PUBLIC_SITE_URL), never from request headers,
 * which a client or a cache in front of the app could forge. Without it, only dev uses the request origin;
 * production returns undefined and the page shows no QR code.
 */
export function posterLink(code: string, siteUrl: string, dev: boolean, requestOrigin: () => string): string | undefined {
  const origin = siteUrl.replace(/\/+$/, '') || (dev ? requestOrigin() : '')
  return origin ? `${origin}/k/${encodeURIComponent(code)}` : undefined
}
