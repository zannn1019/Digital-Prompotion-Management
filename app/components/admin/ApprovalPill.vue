<script setup lang="ts">
// Approval state next to a poster's status in lists: waiting, or the last submission was rejected.
import type { Poster } from '#shared/types'

defineProps<{ poster: Pick<Poster, 'pending' | 'rejection'> }>()
</script>

<template>
  <AdminStatusPill v-if="poster.pending" tone="warning">Menunggu persetujuan</AdminStatusPill>
  <AdminStatusPill v-else-if="poster.rejection" tone="danger">Pengajuan ditolak</AdminStatusPill>
</template>
