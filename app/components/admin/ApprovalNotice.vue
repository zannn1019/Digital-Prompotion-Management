<script setup lang="ts">
// Where a poster or announcement stands in the approval flow, shown at the top of its form.
import { CircleAlert, Clock } from '@lucide/vue'
import type { Poster } from '#shared/types'
import { fmtDateTime } from '#shared/utils/format'

defineProps<{
  poster?: Pick<Poster, 'pending' | 'rejection' | 'status'> & {
    pendingByName?: string | null
    rejectedByName?: string | null
  }
}>()
const { canApprove } = useSession()
</script>

<template>
  <div
    v-if="poster?.pending"
    role="status"
    class="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-[15px] leading-relaxed text-amber-950"
  >
    <Clock class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
    <p v-if="canApprove">
      <b>{{ poster.pendingByName ?? 'Seseorang' }}</b>
      mengajukan perubahan ({{ fmtDateTime(poster.pending.at) }}). Formulir ini menampilkan versi
      yang sedang berlaku.
      <NuxtLink to="/admin/approvals" class="font-semibold underline underline-offset-4">
        Tinjau pengajuan
      </NuxtLink>
    </p>
    <p v-else>
      <b>Menunggu persetujuan</b>
      sejak {{ fmtDateTime(poster.pending.at) }}.
      {{
        poster.status === 'published'
          ? 'Pengunjung masih melihat versi sebelumnya sampai disetujui.'
          : 'Belum tampil untuk pengunjung.'
      }}
      Anda masih bisa mengubahnya; pengajuan ikut diperbarui.
    </p>
  </div>
  <div
    v-else-if="poster?.rejection"
    role="status"
    class="flex gap-3 rounded-xl border border-destructive/40 bg-red-50 px-4 py-3.5 text-[15px] leading-relaxed text-red-950"
  >
    <CircleAlert class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
    <p>
      <b>Pengajuan terakhir ditolak</b>
      oleh {{ poster.rejectedByName ?? 'Approver' }} ({{ fmtDateTime(poster.rejection.at) }}): “{{
        poster.rejection.note
      }}”. Perbaiki, lalu ajukan lagi.
    </p>
  </div>
</template>
