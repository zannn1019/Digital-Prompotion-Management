// Change role, (de)activate, or reset password (which also unlocks).
export default defineEventHandler(async event => {
  const me = requireUser(event, 'super')
  const user = db.users.find(u => u.id === getRouterParam(event, 'id'))
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Pengguna tidak ditemukan.' })
  if (user.id === me.id) throw createError({ statusCode: 422, statusMessage: 'Anda tidak bisa mengubah akun Anda sendiri.' })
  const { role, status, resetPassword } = await parseBody(event, userPatchSchema)

  if (role && role !== user.role) {
    logAudit(me.id, 'Mengubah peran', 'Pengguna', user.name, ROLE_LABEL[user.role], ROLE_LABEL[role])
    user.role = role
    destroyUserSessions(user.id)
  }
  if (status && status !== user.status) {
    logAudit(me.id, status === 'inactive' ? 'Menonaktifkan' : 'Mengaktifkan', 'Pengguna', user.name, user.status, status)
    user.status = status
    if (status === 'inactive') destroyUserSessions(user.id)
  }
  if (resetPassword) {
    if (user.status === 'locked') user.status = 'active'
    user.lockedUntil = null
    // The old password stops working; the new temporary one is stored as a hash and must be changed.
    const password = tempPassword()
    await db.credentials.set(user.id, password)
    user.mustChangePassword = true
    destroyUserSessions(user.id)
    logAudit(me.id, 'Reset sandi', 'Pengguna', user.name, '', 'Sandi sementara dibuat')
    return { user: publicUser(user), tempPassword: password }
  }
  return { user: publicUser(user) }
})
