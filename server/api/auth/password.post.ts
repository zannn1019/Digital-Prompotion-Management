// Change the signed-in user's own password. The only route open to someone with a temporary password.
export default defineEventHandler(async event => {
  rateLimit(event, 'password', 10, 60_000)
  const user = await requireUser(event, undefined, { allowPasswordChange: true })
  const { currentPassword, newPassword } = await parseBody(event, passwordChangeSchema)
  const repo = await useUsers()
  if (!(await repo.verifyPassword(user.id, currentPassword)))
    throw createError({
      statusCode: 422,
      statusMessage: 'Periksa isian',
      data: { errors: { currentPassword: 'Kata sandi saat ini salah.' } },
    })

  await repo.setPassword(user.id, newPassword)
  await repo.update(user.id, { mustChangePassword: false })
  // Other devices signed in with the old password are signed out; this one gets a fresh session.
  await destroyUserSessions(user.id)
  await createSession(event, user.id)
  await logAudit(user.id, 'Ganti sandi', 'Pengguna', user.name, '', 'Sandi diganti')
  return publicUser({ ...user, mustChangePassword: false })
})
