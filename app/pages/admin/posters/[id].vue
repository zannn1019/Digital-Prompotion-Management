<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { Poster } from '#shared/types'

definePageMeta({ layout: 'admin', middleware: 'auth', title: 'Ubah poster' })
const route = useRoute()
const { data, status, refresh } = useFetch<Poster & { pageIds: string[] }>(`/api/posters/${route.params.id}`, { server: false })
</script>

<template>
  <div>
    <AdminPageHeader :title="data?.name ?? 'Ubah poster'" :back="{ to: '/admin/posters', label: 'Kembali ke daftar poster' }" />
    <AdminTableSkeleton v-if="status === 'pending'" :rows="6" />
    <AdminEmptyState
      v-else-if="status === 'error' || !data"
      error
      title="Poster tidak ditemukan"
      description="Mungkin sudah dihapus atau tautannya salah."
    >
      <Button class="h-11" @click="refresh()">Coba lagi</Button>
    </AdminEmptyState>
    <AdminAnnouncementForm v-else-if="data.kind === 'pengumuman'" :poster="data" />
    <AdminPosterForm v-else :poster="data" />
  </div>
</template>
