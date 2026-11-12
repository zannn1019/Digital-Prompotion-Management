// Canvas-editor pages only exist when the feature is switched on (off in V1):
// otherwise "Buat poster" goes straight to the upload form.
export default defineNuxtRouteMiddleware(() => {
  if (!useRuntimeConfig().public.canvasEditor) return navigateTo('/admin/posters/upload', { replace: true })
})
