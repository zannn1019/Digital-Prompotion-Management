// Admin pages: require a session; `meta.superOnly` pages also require Super Admin.
// Someone signed in with a temporary password is sent to change it first.
export default defineNuxtRouteMiddleware(async to => {
  const { user, loaded, refresh } = useSession()
  if (!loaded.value) await refresh()
  if (!user.value) return navigateTo(`/admin/login?ke=${encodeURIComponent(to.fullPath)}`)
  if (user.value.mustChangePassword && to.path !== '/admin/change-password') return navigateTo('/admin/change-password')
  if (to.meta.superOnly && user.value.role !== 'super') return navigateTo('/admin/access-denied')
})
