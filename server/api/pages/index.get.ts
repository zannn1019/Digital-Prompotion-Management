export default defineEventHandler(async event => {
  await requireUser(event)
  const [list, counts] = await Promise.all([(await useContent()).listPages(), (await useCardsRepo()).activeCountByPage()])
  return list.map(pg => ({ ...pg, cardCount: counts.get(pg.id) ?? 0 }))
})
