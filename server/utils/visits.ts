import type { H3Event } from 'h3'
import type { DailyRow } from '#shared/types'
import { TODAY } from '#shared/utils/format'
import { createVisitCounter, type Visit } from './tapCounter'

// One counter for the whole server process: taps and clicks share the 30-second dedupe window.
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

/** Today's analytics row for a card, created on its first tap of the day. */
export function todayRow(card: string, pageId: string): DailyRow {
  let row = db.daily.find(r => r.date === TODAY && r.card === card)
  if (!row) {
    row = { date: TODAY, card, pageId, taps: 0, bots: 0, clicks: {} }
    db.daily.push(row)
  }
  return row
}
