/**
 * Base address written onto NFC cards (`…/k/`). Cards are physical and keep this address for good,
 * so it comes from the configured site address (NUXT_PUBLIC_SITE_URL), never from request headers.
 * Without it: dev uses the address the admin opened, a build falls back to Settings' placeholder.
 * Pure logic, no auto-imports, so tests can use it.
 */
export function cardBaseUrl(siteUrl: string, dev: boolean, requestOrigin: () => string, fallback: string): string {
  const origin = siteUrl.trim().replace(/\/+$/, '') || (dev ? requestOrigin() : '')
  return origin ? `${origin}/k/` : fallback
}
