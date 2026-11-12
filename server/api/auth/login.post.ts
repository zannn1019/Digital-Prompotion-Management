import { nowStamp } from '#shared/utils/format'

const guard = createLoginGuard()

export default defineEventHandler(async event => {
  rateLimit(event, 'login', 20, 60_000)
  const { email, password } = await parseBody(event, loginSchema)
  const user = db.users.find(u => u.email === email)

  // A time-based lock expires on its own; an admin reset also clears it.
  // Only locked accounts unlock: a deactivated account stays deactivated.
  const lock = guard.blocked(email, user, Date.now())
  if (lock) throw createError({ statusCode: 423, statusMessage: 'locked', data: { until: lock.until } })

  // The hash is always checked (a stand-in one for unknown emails), so every answer takes the same time.
  const passwordOk = await db.credentials.verify(user?.id, password)
  if (!user || user.status !== 'active' || !passwordOk) {
    const result = guard.fail(email, user, Date.now())
    if (result.locked) {
      if (result.realLock)
        logAudit(user!.id, 'Gagal masuk', 'Sesi', email, `${MAX_LOGIN_ATTEMPTS} percobaan gagal`, 'Akun terkunci 15 menit')
      throw createError({ statusCode: 423, statusMessage: 'locked', data: { until: result.until } })
    }
    // Same answers for unknown, inactive and wrong password, including the lock: reveals nothing.
    throw createError({ statusCode: 401, statusMessage: 'invalid', data: { remaining: result.remaining } })
  }

  guard.succeed(email)
  user.lastLogin = nowStamp()
  createSession(event, user.id)
  logAudit(user.id, 'Masuk', 'Sesi', 'Panel Admin', '', 'Login berhasil')
  return publicUser(user)
})
