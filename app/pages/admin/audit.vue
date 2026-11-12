<script setup lang="ts">
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AuditEntry } from '#shared/types'
import { fmtDateTime } from '#shared/utils/format'

definePageMeta({ layout: 'admin', middleware: 'auth', title: 'Audit Log', superOnly: true })
const { data, status, refresh } = useFetch<(AuditEntry & { userName: string })[]>('/api/audit', { server: false })

const q = ref('')
const fUser = ref('')
const fAction = ref('')
const fEntity = ref('')
const uniq = (k: 'userName' | 'action' | 'entity') => [...new Set((data.value ?? []).map(a => a[k]))].sort()
const rows = computed(() =>
  (data.value ?? []).filter(
    a =>
      (!q.value || `${a.target} ${a.before} ${a.after}`.toLowerCase().includes(q.value.toLowerCase())) &&
      (!fUser.value || a.userName === fUser.value) &&
      (!fAction.value || a.action === fAction.value) &&
      (!fEntity.value || a.entity === fEntity.value),
  ),
)
</script>

<template>
  <div>
    <AdminPageHeader title="Audit Log" description="Jejak semua perubahan. Disimpan sesuai masa retensi di Pengaturan." />
    <div class="mb-4 flex flex-wrap gap-3">
      <Input
        v-model="q"
        type="search"
        aria-label="Cari log"
        placeholder="Cari nama objek atau ringkasan…"
        class="h-11 min-w-60 grow basis-60"
      />
      <AdminNativeSelect v-model="fUser" aria-label="Pengguna"
        ><option value="">Semua pengguna</option>
        <option v-for="v in uniq('userName')" :key="v">{{ v }}</option></AdminNativeSelect
      >
      <AdminNativeSelect v-model="fAction" aria-label="Tindakan"
        ><option value="">Semua tindakan</option>
        <option v-for="v in uniq('action')" :key="v">{{ v }}</option></AdminNativeSelect
      >
      <AdminNativeSelect v-model="fEntity" aria-label="Objek"
        ><option value="">Semua objek</option>
        <option v-for="v in uniq('entity')" :key="v">{{ v }}</option></AdminNativeSelect
      >
    </div>
    <Card class="overflow-hidden py-0">
      <AdminDataState
        :status="status"
        :empty="!rows.length"
        empty-title="Tidak ada yang cocok"
        empty-description="Coba kata kunci lain atau hapus filter."
        @retry="refresh()"
      >
        <Table class="min-w-[860px]">
          <TableHeader
            ><TableRow
              ><TableHead class="pl-4">Waktu</TableHead><TableHead>Pengguna</TableHead><TableHead>Tindakan</TableHead
              ><TableHead>Objek</TableHead><TableHead class="pr-4">Sebelum → Sesudah</TableHead></TableRow
            ></TableHeader
          >
          <TableBody>
            <TableRow v-for="a in rows" :key="a.id">
              <TableCell class="pl-4 text-[13px] whitespace-nowrap text-muted-foreground">{{ fmtDateTime(a.at) }}</TableCell>
              <TableCell>{{ a.userName }}</TableCell>
              <TableCell
                ><AdminStatusPill>{{ a.action }}</AdminStatusPill></TableCell
              >
              <TableCell
                ><b class="font-medium">{{ a.target }}</b>
                <div class="text-xs text-muted-foreground">{{ a.entity }}</div></TableCell
              >
              <TableCell class="pr-4 text-xs">
                <div class="flex flex-wrap items-center gap-1.5">
                  <template v-if="a.before"
                    ><span class="rounded bg-red-50 px-2 py-0.5 text-red-800 line-through">{{ a.before }}</span
                    ><span aria-hidden="true" class="text-muted-foreground">→</span></template
                  >
                  <span class="rounded bg-green-50 px-2 py-0.5 text-green-800">{{ a.after }}</span>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </AdminDataState>
    </Card>
  </div>
</template>
