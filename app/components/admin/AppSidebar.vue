<script setup lang="ts">
import { ROLE_LABEL } from '#shared/constants'
import type { Settings as SiteSettings } from '#shared/types'
import { BarChart3, CreditCard, FileImage, History, Home, LayoutPanelTop, Settings, Users } from '@lucide/vue'

const props = defineProps<{ expiringCount?: number }>()
const { user, isSuper } = useSession()
const { data: settings } = useFetch<SiteSettings>('/api/settings', { key: 'settings', server: false })

const groups = computed(() => [
  { title: 'Utama', items: [{ to: '/admin', label: 'Beranda', icon: Home, count: props.expiringCount }] },
  {
    title: 'Konten',
    items: [
      { to: '/admin/poster', label: 'Poster & Pengumuman', icon: FileImage },
      { to: '/admin/halaman', label: 'Halaman', icon: LayoutPanelTop },
    ],
  },
  {
    title: 'Kartu & Data',
    items: [
      { to: '/admin/kartu', label: 'Kartu NFC', icon: CreditCard },
      { to: '/admin/analitik', label: 'Analitik', icon: BarChart3 },
    ],
  },
  // Staff Konten never sees these.
  ...(isSuper.value
    ? [
        {
          title: 'Sistem',
          items: [
            { to: '/admin/pengguna', label: 'Pengguna', icon: Users },
            { to: '/admin/audit', label: 'Audit Log', icon: History },
            { to: '/admin/pengaturan', label: 'Pengaturan', icon: Settings },
          ],
        },
      ]
    : []),
])

const route = useRoute()
function isActive(to: string) {
  return to === '/admin' ? route.path === '/admin' : route.path.startsWith(to)
}
</script>

<template>
  <nav aria-label="Navigasi utama" class="flex h-full flex-col gap-1 border-r bg-sidebar px-3 py-4 text-sidebar-foreground">
    <NuxtLink to="/admin" class="flex items-center px-2 pb-4">
      <span class="flex flex-col gap-1.5">
        <img
          :src="settings?.logoUrl ?? '/brand/logo.png'"
          :alt="settings?.company ?? 'Logo'"
          width="159"
          height="36"
          class="block h-9 w-auto"
        />
        <span class="text-xs text-muted-foreground">Poster Digital NFC · Panel Admin</span>
      </span>
    </NuxtLink>

    <div v-for="g in groups" :key="g.title" class="mt-2 flex flex-col gap-0.5">
      <div class="px-2 py-1 text-xs font-medium text-muted-foreground">{{ g.title }}</div>
      <NuxtLink
        v-for="it in g.items"
        :key="it.to"
        :to="it.to"
        :aria-current="isActive(it.to) ? 'page' : undefined"
        class="flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-zinc-700 hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
      >
        <component :is="it.icon" class="size-4" aria-hidden="true" />
        <span class="grow">{{ it.label }}</span>
        <span
          v-if="'count' in it && it.count"
          class="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white"
          :aria-label="`${it.count} konten segera berakhir`"
          >{{ it.count }}</span
        >
      </NuxtLink>
    </div>

    <div class="mt-auto flex items-center gap-2.5 rounded-lg border bg-background p-2.5">
      <span aria-hidden="true" class="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">{{
        initials(user?.name)
      }}</span>
      <span class="flex flex-col leading-tight">
        <b class="text-[13px] font-semibold">{{ user?.name }}</b>
        <span class="text-xs text-muted-foreground">{{ user ? ROLE_LABEL[user.role] : '' }}</span>
      </span>
    </div>
  </nav>
</template>
