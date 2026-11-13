// Change role, (de)activate, or reset password (which also unlocks).
export default defineEventHandler(async event => {
  const me = await requireUser(event, 'super')
  const repo = await useUsers()
  const user = await repo.byId(getRouterParam(event, 'id') ?? '')
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Pengguna tidak ditemukan.' })
  if (user.id === me.id) throw createError({ statusCode: 422, statusMessage: 'Anda tidak bisa mengubah akun Anda sendiri.' })
  const { role, status, resetPassword } = await parseBody(event, userPatchSchema)

  if (role && role !== user.role) {
    await logAudit(me.id, 'Mengubah peran', 'Pengguna', user.name, ROLE_LABEL[user.role], ROLE_LABEL[role])
    user.role = role
    await repo.update(user.id, { role })
    await destroyUserSessions(user.id)
  }
  if (status && status !== user.status) {
    await logAudit(me.id, status === 'inactive' ? 'Menonaktifkan' : 'Mengaktifkan', 'Pengguna', user.name, user.status, status)
    user.status = status
    await repo.update(user.id, { status })
    if (status === 'inactive') await destroyUserSessions(user.id)
  }
  if (resetPassword) {
    // The old password stops working; the new temporary one is stored as a hash and must be changed.
    // A reset also lifts a login lock.
    const password = tempPassword()
    if (user.status === 'locked') user.status = 'active'
    user.lockedUntil = null
    user.mustChangePassword = true
    await repo.setPassword(user.id, password)
    await repo.update(user.id, { status: user.status, lockedUntil: null, mustChangePassword: true })
    await destroyUserSessions(user.id)
    await logAudit(me.id, 'Reset sandi', 'Pengguna', user.name, '', 'Sandi sementara dibuat')
    return { user: publicUser(user), tempPassword: password }
  }
  return { user: publicUser(user) }
})
