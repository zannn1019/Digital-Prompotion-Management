// Uploaded files: the bytes on disk (one file per upload, named by its random ID), the details in PostgreSQL.
// Plain Node code (no Nuxt imports).
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Database } from '../db/client'
import { uploads } from '../db/schema'

/** IDs are `f` + 32 hex characters; anything else never reaches the file system. */
const ID = /^f[0-9a-f]{32}$/

export function uploadsRepo(db: Database, dir: string) {
  return {
    async save(input: { data: Uint8Array; type: string; name: string; userId: string }): Promise<{ id: string }> {
      // 128 random bits: upload addresses can't be guessed or counted through.
      const id = `f${randomBytes(16).toString('hex')}`
      await mkdir(dir, { recursive: true })
      // Write the bytes first: a row without a file would be a broken link.
      await writeFile(join(dir, id), input.data, { flag: 'wx' })
      await db.insert(uploads).values({ id, type: input.type, size: input.data.length, name: input.name, createdBy: input.userId })
      return { id }
    },

    /** The file's type and bytes, or null when it doesn't exist. */
    async read(id: string): Promise<{ type: string; data: Buffer } | null> {
      if (!ID.test(id)) return null
      const [row] = await db.select().from(uploads).where(eq(uploads.id, id))
      if (!row) return null
      try {
        return { type: row.type, data: await readFile(join(dir, id)) }
      } catch {
        return null
      }
    },
  }
}
