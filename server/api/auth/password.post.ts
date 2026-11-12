// Change the signed-in user's own password. The only route open to someone with a temporary password.
export default defineEventHandler(async event => {
  rateLimit(event, 'password', 10, 60_000)
  const user = requireUser(event, undefined, { allowPasswordChange: true })
  const { currentPassword, newPassword } = await parseBody(event, passwordChangeSchema)
  if (!(await db.credentials.verify(user.id, currentPassword)))
    throw createError({
      statusCode: 422,
      statusMessage: 'Periksa isian',
      data: { errors: { currentPassword: 'Kata sandi saat ini salah.' } },
    })

  await db.credentials.set(user.id, newPassword)
  user.mustChangePassword = false
  // Other devices signed in with the old password are signed out; this one gets a fresh session.
  destroyUserSessions(user.id)
  createSession(event, user.id)
  logAudit(user.id, 'Ganti sandi', 'Pengguna', user.name, '', 'Sandi diganti')
  return publicUser(user)
})
