import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto'

// Password hashing for the prototype: scrypt with a random 16-byte salt per password, compared in
// constant time. Hashes live in a store of their own (db.credentials), never on the User object,
// so no API response can include them. Pure logic, no auto-imports, so tests can use it.
// Request-time hashing runs on Node's thread pool (async scrypt): one hash takes ~40 ms of CPU, and the
// synchronous version would stop the whole server for that long on every login attempt.

/** Password of every seeded demo account. */
export const DEMO_PASSWORD = 'demo123'
/** Shortest password a user may choose. */
export const MIN_PASSWORD_LENGTH = 10
const KEY_LENGTH = 64

export interface PasswordHash {
  salt: string
  hash: string
}

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, KEY_LENGTH, (err, key) => (err ? reject(err) : resolve(key))))
}

/** Synchronous hash, only for start-up seeding (before any request is served). */
export function hashPasswordSync(password: string): PasswordHash {
  const salt = randomBytes(16)
  return { salt: salt.toString('base64'), hash: scryptSync(password, salt, KEY_LENGTH).toString('base64') }
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = randomBytes(16)
  return { salt: salt.toString('base64'), hash: (await derive(password, salt)).toString('base64') }
}

// Checked when an email has no account, so a wrong email takes as long as a wrong password.
const STAND_IN = hashPasswordSync(randomBytes(16).toString('hex'))

export async function verifyPassword(password: string, stored: PasswordHash | undefined): Promise<boolean> {
  const target = stored ?? STAND_IN
  const expected = Buffer.from(target.hash, 'base64')
  const actual = await derive(password, Buffer.from(target.salt, 'base64'))
  return timingSafeEqual(actual, expected) && stored !== undefined
}

/** One-time password shown once to the admin; the user must change it at first sign-in. */
export function tempPassword() {
  return randomBytes(9).toString('base64url')
}

/** Password hashes by user ID. */
export function createCredentialStore() {
  const hashes = new Map<string, PasswordHash>()
  return {
    /** Start-up seeding only. */
    seed(userId: string, password: string) {
      hashes.set(userId, hashPasswordSync(password))
    },
    async set(userId: string, password: string) {
      hashes.set(userId, await hashPassword(password))
    },
    verify(userId: string | undefined, password: string) {
      return verifyPassword(password, userId ? hashes.get(userId) : undefined)
    },
    has: (userId: string) => hashes.has(userId),
  }
}
