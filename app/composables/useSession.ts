import type { User } from '#shared/types'

/** Current admin user, loaded once from /api/auth/me. */
export function useSession() {
  const user = useState<User | null>('session-user', () => null)
  const loaded = useState('session-loaded', () => false)

  async function refresh() {
    user.value = await $fetch<User | null>('/api/auth/me').catch(() => null)
    loaded.value = true
    return user.value
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    await navigateTo('/admin/login?keluar=1')
  }

  const isSuper = computed(() => user.value?.role === 'super')
  return { user, loaded, refresh, logout, isSuper }
}
