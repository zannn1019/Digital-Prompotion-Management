export default defineEventHandler(async event => {
  const me = await requireUser(event, 'super')
  const { name, email, role } = await parseBody(event, userCreateSchema)

  // The temporary password is stored as a hash only and must be changed at first sign-in.
  const password = tempPassword()
  // The unique email index decides, so two requests at once can't both create the same email.
  const user = await (await useUsers()).create({ name, email, role, password, mustChangePassword: true })
  if (!user)
    throw createError({
      statusCode: 422,
      statusMessage: 'Periksa isian',
      data: { errors: { email: 'Email ini sudah dipakai pengguna lain.' } },
    })
  await logAudit(me.id, 'Membuat', 'Pengguna', user.name, '', ROLE_LABEL[role])
  return { user: publicUser(user), tempPassword: password }
})
