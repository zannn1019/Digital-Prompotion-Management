// Active Marketing users with their contact, for the "Marketing penanggung jawab" pickers.
// Any signed-in user may read it; the full user list stays Super Admin only.
export default defineEventHandler(async event => {
  await requireUser(event)
  return (await (await useUsers()).list())
    .filter(u => u.role === 'marketing' && u.status === 'active')
    .map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      wa: u.wa ?? null,
      phone: u.phone ?? null,
    }))
})
