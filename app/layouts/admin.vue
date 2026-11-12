<script setup lang="ts">
import { ChevronDown, ExternalLink, KeyRound, LogOut, Menu, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const route = useRoute()
const { user, logout } = useSession()
const { data: dash } = useFetch('/api/dashboard', { key: 'sidebar-dash', server: false })
const expiringCount = computed(() => dash.value?.expiring.length ?? 0)
// "Lihat poster" opens what visitors see for the first active card that has a page; hidden until one exists.
const { cards } = useCards()
const previewCard = computed(() => cards.value?.find(c => c.status === 'aktif' && c.pageName))

const navOpen = ref(false)
watch(
  () => route.fullPath,
  () => {
    navOpen.value = false
  },
)
const confirmLogout = ref(false)
const title = computed(() => (route.meta.title as string) || 'Panel Admin')
useHead({ title: () => `${title.value} · Panel Admin` })
</script>

<template>
  <div class="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >Lewati ke konten utama</a
    >

    <div class="sticky top-0 hidden h-screen lg:block">
      <AdminAppSidebar :expiring-count="expiringCount" />
    </div>
    <!-- Mobile / tablet drawer -->
    <div v-if="navOpen" class="fixed inset-0 z-40 lg:hidden">
      <div class="absolute inset-0 bg-black/50" @click="navOpen = false" />
      <div id="mobile-nav" class="absolute inset-y-0 left-0 w-72 shadow-xl">
        <AdminAppSidebar :expiring-count="expiringCount" />
      </div>
    </div>

    <div class="flex min-w-0 flex-col">
      <header class="sticky top-0 z-30 flex min-h-15 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-6">
        <Button
          variant="ghost"
          size="icon"
          class="size-11 lg:hidden"
          :aria-expanded="navOpen"
          aria-controls="mobile-nav"
          :aria-label="navOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'"
          @click="navOpen = !navOpen"
        >
          <component :is="navOpen ? X : Menu" class="size-5" />
        </Button>
        <div class="grow truncate text-sm text-muted-foreground">
          Panel Admin <span aria-hidden="true">/</span> <b class="font-medium text-foreground">{{ title }}</b>
        </div>
        <Button v-if="previewCard" as-child variant="outline" class="hidden h-10 sm:inline-flex">
          <a :href="`/k/${previewCard.code}`" target="_blank" rel="noopener" :title="`Kartu ${previewCard.label} · ${previewCard.pageName}`"
            ><ExternalLink class="size-4" />Lihat poster</a
          >
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" class="h-11 gap-2 rounded-full px-2" aria-label="Menu pengguna">
              <span class="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">{{
                initials(user?.name)
              }}</span>
              <ChevronDown class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-60">
            <DropdownMenuLabel>
              <div class="text-sm">{{ user?.name }}</div>
              <div class="text-xs font-normal text-muted-foreground">{{ user?.email }}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="min-h-11" @select="navigateTo('/admin/change-password')">
              <KeyRound class="size-4" />Ganti kata sandi
            </DropdownMenuItem>
            <DropdownMenuItem class="min-h-11 text-destructive focus:text-destructive" @select="confirmLogout = true">
              <LogOut class="size-4" />Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main id="main" tabindex="-1" class="mx-auto w-full px-4 py-6 md:px-6 md:py-8">
        <slot />
      </main>
    </div>

    <AlertDialog v-model:open="confirmLogout">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Keluar dari Panel Admin?</AlertDialogTitle>
          <AlertDialogDescription
            >Anda perlu masuk lagi untuk mengubah konten. Perubahan yang sudah disimpan tetap aman.</AlertDialogDescription
          >
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel class="h-11">Batal</AlertDialogCancel>
          <AlertDialogAction class="h-11" @click="logout">Ya, keluar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
