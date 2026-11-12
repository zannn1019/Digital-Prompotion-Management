// The demo video studio exists only when NUXT_PUBLIC_VIDEO_STUDIO=true (dev).
export default defineNuxtRouteMiddleware(() => {
  if (!useRuntimeConfig().public.videoStudio)
    return abortNavigation(createError({ statusCode: 404, statusMessage: 'Halaman tidak ditemukan' }))
})
