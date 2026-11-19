export default defineEventHandler(async event => {
  await requireUser(event)
  const [list, counts, names] = await Promise.all([
    (await useContent()).listPages(),
    (await useCardsRepo()).activeCountByPage(),
    (await useUsers()).names(),
  ])
  return list.map(pg => ({
    ...pg,
    cardCount: counts.get(pg.id) ?? 0,
    ownerName: (pg.ownerId && names.get(pg.ownerId)) || null,
  }))
})
