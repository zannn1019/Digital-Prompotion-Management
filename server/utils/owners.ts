import type { User } from '#shared/types'
import { pickOwner } from './access'

/** The owner to save (see pickOwner), or a 422 that points at the owner field. */
export async function resolveOwner(
  requested: string | null | undefined,
  me: User,
  current?: string | null,
): Promise<string | null> {
  const found = requested ? await (await useUsers()).byId(requested) : null
  const result = pickOwner(requested, me, current, found)
  if ('error' in result)
    throw createError({
      statusCode: 422,
      statusMessage: 'Periksa isian',
      data: { errors: { ownerId: result.error } },
    })
  return result.ownerId
}
