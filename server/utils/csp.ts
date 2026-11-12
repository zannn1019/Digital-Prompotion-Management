import { createHash } from 'node:crypto'

// Content-Security-Policy without 'unsafe-inline' for scripts. Nuxt puts a small inline script on each
// page (the runtime config); its exact text is hashed per response and allowed by that hash only.
// Pure logic, no auto-imports, so tests can use it.

const SCRIPT_TAG = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
/** Script types the browser does not run (data blocks such as Nuxt's JSON payload). */
const DATA_TYPE = /\btype\s*=\s*["']?(application\/json|application\/ld\+json|text\/template)/i

/** `'sha256-…'` sources for every inline script in the HTML that the browser would run. */
export function inlineScriptHashes(html: string): string[] {
  const out = new Set<string>()
  for (const [, attrs = '', body = ''] of html.matchAll(SCRIPT_TAG)) {
    if (/\bsrc\s*=/i.test(attrs) || DATA_TYPE.test(attrs) || !body) continue
    out.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`)
  }
  return [...out]
}

/** The policy. Inline styles stay allowed (Vue style bindings); scripts only from this site or by hash. */
export function cspHeader(scriptHashes: string[] = []): string {
  return [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    ["script-src 'self'", ...scriptHashes].join(' '),
    // The build inlines small font files as data: URIs.
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ')
}
