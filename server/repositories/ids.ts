import { randomBytes } from 'node:crypto'

/** Random ID with a readable prefix (p… poster, a… announcement, pg… page). Not guessable, never reused. */
export const newId = (prefix: string) => `${prefix}${randomBytes(6).toString('hex')}`

/** True for a PostgreSQL unique-constraint violation (code 23505), e.g. a page name already in use. */
export const isUniqueViolation = (e: unknown) =>
  !!e &&
  typeof e === 'object' &&
  ((e as { code?: string }).code === '23505' || (e as { cause?: { code?: string } }).cause?.code === '23505')
