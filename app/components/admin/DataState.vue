<script setup lang="ts">
// Loading / error / empty states for any fetched list. Renders the default slot when there is data.
import type { Component } from 'vue'
import { Button } from '@/components/ui/button'

defineProps<{
  status: 'idle' | 'pending' | 'success' | 'error'
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: Component
  rows?: number
}>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <AdminTableSkeleton v-if="status === 'pending' || status === 'idle'" :rows="rows" />
  <AdminEmptyState
    v-else-if="status === 'error'"
    error
    title="Data gagal dimuat"
    description="Periksa koneksi internet Anda, lalu coba lagi. Data Anda tidak berubah."
  >
    <Button class="h-11" @click="emit('retry')">Coba lagi</Button>
  </AdminEmptyState>
  <AdminEmptyState v-else-if="empty" :icon="emptyIcon" :title="emptyTitle ?? 'Belum ada data'" :description="emptyDescription">
    <slot name="empty-actions" />
  </AdminEmptyState>
  <slot v-else />
</template>
