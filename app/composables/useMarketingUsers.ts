/** An active Marketing user with the contact their posters' buttons use. */
export interface Marketer {
  id: string
  name: string
  email: string
  wa: string | null
  phone: string | null
}

/** Active Marketing users for the owner pickers, filters and contact preview; one shared request. */
export function useMarketingUsers() {
  const { data, refresh } = useFetch<Marketer[]>('/api/users/marketing', {
    key: 'marketing-users',
    server: false,
    default: () => [],
  })
  return { marketers: data, refresh }
}
