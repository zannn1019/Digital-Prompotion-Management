import type { User } from '#shared/types'
import type { UsersRepo } from '../../repositories/users'

const guard = createLoginGuard()

/** Saves the lock state when the guard changed it (lock set, or an expired lock lifted). */
async function saveLockState(repo: UsersRepo, user: User | null, before: Pick<User, 'status' | 'lockedUntil'> | null) {
  if (!user || !before) return
  if (user.status !== before.status || (user.lockedUntil ?? null) !== (before.lockedUntil ?? null))
    await repo.update(user.id, { status: user.status, lockedUntil: user.lockedUntil ?? null })
}

export default defineEventHandler(async event => {
  rateLimit(event, 'login', 20, 60_000)
  const { email, password } = await parseBody(event, loginSchema)
  const repo = await useUsers()
  const user = await repo.byEmail(email)
  const before = user && { status: user.status, lockedUntil: user.lockedUntil ?? null }

  // A time-based lock expires on its own; an admin reset also clears it.
  // Only locked accounts unlock: a deactivated account stays deactivated.
  const lock = guard.blocked(email, user ?? undefined, Date.now())
  await saveLockState(repo, user, before)
  if (lock) throw createError({ statusCode: 423, statusMessage: 'locked', data: { until: lock.until } })

  // The hash is always checked (a stand-in one for unknown emails), so every answer takes the same time.
  const passwordOk = await repo.verifyPassword(user?.id, password)
  if (!user || user.status !== 'active' || !passwordOk) {
    const result = guard.fail(email, user ?? undefined, Date.now())
    await saveLockState(repo, user, before)
    if (result.locked) {
      if (result.realLock)
        await logAudit(user!.id, 'Gagal masuk', 'Sesi', email, `${MAX_LOGIN_ATTEMPTS} percobaan gagal`, 'Akun terkunci 15 menit')
      throw createError({ statusCode: 423, statusMessage: 'locked', data: { until: result.until } })
    }
    // Same answers for unknown, inactive and wrong password, including the lock: reveals nothing.
    throw createError({ statusCode: 401, statusMessage: 'invalid', data: { remaining: result.remaining } })
  }

  guard.succeed(email)
  await repo.update(user.id, { lastLogin: new Date() })
  await createSession(event, user.id)
  await logAudit(user.id, 'Masuk', 'Sesi', 'Panel Admin', '', 'Login berhasil')
  return publicUser({ ...user, lastLogin: (await repo.byId(user.id))?.lastLogin ?? user.lastLogin })
})
