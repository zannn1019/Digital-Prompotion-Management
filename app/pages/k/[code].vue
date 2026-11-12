<script setup lang="ts">
// Public poster opened by tapping an NFC card. Server-rendered, no cookies.
import type { PublicView } from '#shared/types'
import { VISITOR_IP_HEADER } from '#shared/constants'

const route = useRoute()
const code = String(route.params.code).toUpperCase()
// "Info lainnya" cards open another poster of the same page in full.
const posterId = computed(() => (typeof route.query.p === 'string' ? route.query.p.slice(0, 40) : undefined))
// While rendering on the server, the API call comes from the server itself: pass on who the visitor is,
// so the tap is counted per visitor and not once for everyone.
const visitor = import.meta.server ? useRequestEvent()?.context.clientIp : undefined
const { data } = await useFetch<PublicView>(`/api/public/k/${code}`, {
  headers: visitor ? { [VISITOR_IP_HEADER]: visitor } : undefined,
})
if (data.value?.kind === 'notfound' && import.meta.server) setResponseStatus(useRequestEvent()!, 404)
// Shown as a QR code on wide screens so a laptop visitor can continue on their phone (see app/utils/posterLink.ts).
const pageUrl = posterLink(code, useRuntimeConfig().public.siteUrl, import.meta.dev, () => useRequestURL().origin)

useHead({
  title: () =>
    data.value?.kind === 'notfound'
      ? `Halaman tidak tersedia · ${data.value.settings.company}`
      : (data.value?.settings.company ?? 'Poster'),
  htmlAttrs: { lang: 'id' },
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
    { name: 'theme-color', content: '#ffffff' },
  ],
  bodyAttrs: { class: 'bg-brand-bg' },
})
</script>

<template>
  <PosterView v-if="data" :view="data" :code="code" :page-url="pageUrl" :poster-id="posterId" class="min-h-screen" />
</template>
