import type { H3Event } from 'h3'
import { createVisitCounter, type Visit } from './tapCounter'

// One counter for the whole server process: taps and clicks share the 30-second dedupe window.
// (With several app containers each keeps its own window; one container is the supported setup.)
const counter = createVisitCounter()

/** Decides whether this request counts, using the visitor's address and the prefetch and user-agent headers. */
export function classifyVisit(event: H3Event, key: string): Visit {
  return counter.classify(
    clientIp(event),
    key,
    {
      secPurpose: getRequestHeader(event, 'sec-purpose'),
      purpose: getRequestHeader(event, 'purpose'),
      userAgent: getRequestHeader(event, 'user-agent'),
    },
    Date.now(),
  )
}
