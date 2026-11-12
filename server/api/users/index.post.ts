import type { User } from '#shared/types'

export default defineEventHandler(async event => {
  const me = requireUser(event, 'super')
  const { name, email, role } = await parseBody(event, userCreateSchema)
  if (db.users.some(u => u.email === email))
    throw createError({
      statusCode: 422,
      statusMessage: 'Periksa isian',
      data: { errors: { email: 'Email ini sudah dipakai pengguna lain.' } },
    })

  // The temporary password is stored as a hash only and must be changed at first sign-in.
  const user: User = { id: nextId('u'), name, email, role, status: 'active', lastLogin: null, mustChangePassword: true }
  // Added before the (async) hashing so a second request with the same email sees it. Until the hash
  // is stored, sign-in simply fails.
  db.users.push(user)
  const password = tempPassword()
  await db.credentials.set(user.id, password)
  logAudit(me.id, 'Membuat', 'Pengguna', user.name, '', ROLE_LABEL[role])
  return { user: publicUser(user), tempPassword: password }
})
