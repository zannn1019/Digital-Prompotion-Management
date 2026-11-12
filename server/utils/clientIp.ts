import type { H3Event } from 'h3'
import { VISITOR_IP_HEADER } from '#shared/constants'

/**
 * Picks the client address used for rate limiting and tap counting.
 * Without a trusted proxy, `X-Forwarded-For` is whatever the client typed, so only the socket address counts.
 * Behind one trusted proxy (Nginx `proxy_add_x_forwarded_for`), the proxy appends the real client address,
 * so the right-most entry is the one to use; anything to its left can be forged.
 * A request with no socket address is the server calling its own API while rendering a page; only then
 * is `visitor` (the address of the page's visitor, passed by that page) used. Requests from outside always
 * arrive on a socket, so they can't use it.
 */
export function pickClientIp(
  socketAddress: string | undefined,
  forwardedFor: string | undefined,
  trustProxy: boolean,
  visitor?: string,
): string {
  if (!socketAddress && visitor) return visitor
  if (trustProxy) {
    const last = forwardedFor
      ?.split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .pop()
    if (last) return last
  }
  return socketAddress || 'unknown'
}

/** Client address for this request. Set NUXT_TRUST_PROXY=true only when the app runs behind its own proxy. */
export function clientIp(event: H3Event): string {
  return pickClientIp(
    event.node.req.socket?.remoteAddress,
    getRequestHeader(event, 'x-forwarded-for'),
    !!useRuntimeConfig(event).trustProxy,
    getRequestHeader(event, VISITOR_IP_HEADER),
  )
}
