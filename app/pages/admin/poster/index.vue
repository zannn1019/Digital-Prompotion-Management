<script setup lang="ts">
import { Archive, Copy, Ellipsis, FileImage, Megaphone, Pencil, Plus, RotateCcw } from '@lucide/vue'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Poster, PosterKind, PosterState } from '#shared/types'
import { POSTER_STATE } from '#shared/constants'
import { fmtDateTime, fmtRange } from '#shared/utils/format'

definePageMeta({ layout: 'admin', middleware: 'auth', title: 'Poster & Pengumuman' })

type Row = Poster & { state: PosterState; pages: { id: string; name: string }[]; updatedByName: string }
const { data, status, refresh } = useFetch<Row[]>('/api/posters', { server: false })

const tab = ref<'aktif' | 'arsip'>('aktif')
const q = ref('')
const kind = ref<'' | PosterKind>('')
const state = ref<'' | PosterState>('')
const filtered = computed(() => !!(q.value || kind.value || state.value))
const rows = computed(() =>
  (data.value ?? []).filter(
    p =>
      (tab.value === 'arsip' ? p.archived : !p.archived) &&
      (!kind.value || p.kind === kind.value) &&
      (!state.value || p.state === state.value) &&
      (!q.value || p.name.toLowerCase().includes(q.value.toLowerCase())),
  ),
)
const counts = computed(() => ({
  aktif: (data.value ?? []).filter(p => !p.archived).length,
  arsip: (data.value ?? []).filter(p => p.archived).length,
}))
function resetFilters() {
  q.value = ''
  kind.value = ''
  state.value = ''
}

// ---- Actions -------------------------------------------------------------
const toArchive = ref<Row | null>(null)
const archiveOpen = computed({
  get: () => !!toArchive.value,
  set: v => {
    if (!v) toArchive.value = null
  },
})
/** `undo`: the toast's "Urungkan" puts the poster back as it was; a later restore comes back as Draft. */
async function setArchived(p: Pick<Row, 'id' | 'name'>, archived: boolean, undo = false) {
  const url: string = `/api/posters/${p.id}/archive`
  const res = await $fetch<Poster>(url, { method: 'POST', body: { archived, undo } })
  await refresh()
  if (archived)
    toast.success('Poster diarsipkan. Sudah tidak tampil di halaman mana pun.', {
      action: { label: 'Urungkan', onClick: () => setArchived(p, false, true) },
    })
  else if (undo && res.status === 'published') toast.success(`“${p.name}” tampil lagi sesuai jadwal.`)
  else toast.success(`“${p.name}” dipulihkan sebagai Draft.`)
}
async function duplicate(id: string) {
  const copy = await $fetch<Poster>(`/api/posters/${id}/duplicate`, { method: 'POST' })
  await refresh()
  toast.success(`Salinan dibuat sebagai Draft: “${copy.name}”.`)
}
const archiveText = computed(() => {
  const n = toArchive.value?.pages.length ?? 0
  return `Poster langsung berhenti tampil di ${n ? `${n} halaman yang memakainya` : 'semua halaman'}. Poster tidak dihapus — Anda bisa memulihkannya dari tab Arsip kapan saja.`
})
</script>

<template>
  <div>
    <AdminPageHeader title="Poster & Pengumuman" description="Poster hanya tampil bila berstatus Terbit dan berada dalam jadwal tayang.">
      <Button as-child variant="outline" class="h-11"
        ><NuxtLink to="/admin/pengumuman/baru"><Megaphone class="size-4" />Buat pengumuman</NuxtLink></Button
      >
      <Button as-child class="h-11"
        ><NuxtLink to="/admin/poster/buat"><Plus class="size-4" />Buat poster</NuxtLink></Button
      >
    </AdminPageHeader>

    <Tabs v-model="tab" class="mb-4">
      <TabsList>
        <TabsTrigger value="aktif" class="h-9 px-4"
          >Aktif <span class="ml-1 text-muted-foreground">{{ counts.aktif }}</span></TabsTrigger
        >
        <TabsTrigger value="arsip" class="h-9 px-4"
          >Arsip <span class="ml-1 text-muted-foreground">{{ counts.arsip }}</span></TabsTrigger
        >
      </TabsList>
    </Tabs>

    <div class="mb-4 flex flex-wrap items-end gap-3">
      <div class="flex min-w-60 grow flex-col gap-1.5">
        <Label for="q">Cari</Label>
        <Input id="q" v-model="q" type="search" placeholder="Cari nama poster…" class="h-11" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="kind">Jenis</Label>
        <AdminNativeSelect id="kind" v-model="kind">
          <option value="">Semua jenis</option>
          <option value="gambar">Poster gambar</option>
          <option value="pengumuman">Pengumuman</option>
        </AdminNativeSelect>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="state">Status</Label>
        <AdminNativeSelect id="state" v-model="state">
          <option value="">Semua status</option>
          <option v-for="(s, k) in POSTER_STATE" :key="k" :value="k">{{ s.label }}</option>
        </AdminNativeSelect>
      </div>
    </div>

    <Card class="overflow-hidden py-0">
      <AdminDataState
        :status="status"
        :empty="!rows.length"
        :empty-icon="FileImage"
        :empty-title="filtered ? 'Tidak ada yang cocok' : tab === 'arsip' ? 'Arsip kosong' : 'Belum ada poster'"
        :empty-description="
          filtered
            ? 'Coba kata kunci lain atau hapus filter.'
            : tab === 'arsip'
              ? 'Poster yang diarsipkan akan muncul di sini dan bisa dipulihkan.'
              : 'Unggah poster pertama Anda.'
        "
        @retry="refresh()"
      >
        <template #empty-actions>
          <Button v-if="filtered" variant="outline" class="h-11" @click="resetFilters">Hapus filter</Button>
          <Button v-else-if="tab === 'aktif'" as-child class="h-11"><NuxtLink to="/admin/poster/buat">Buat poster</NuxtLink></Button>
        </template>
        <!-- Phone: one card per poster, so status and actions stay on screen. -->
        <ul class="divide-y md:hidden">
          <li v-for="p in rows" :key="p.id" class="flex gap-3 p-4">
            <img v-if="p.imageUrl" :src="p.imageUrl" alt="" class="h-16 w-13 shrink-0 rounded bg-muted object-cover" loading="lazy" />
            <span v-else class="flex h-16 w-13 shrink-0 items-center justify-center rounded bg-amber-100 text-amber-800"
              ><Megaphone class="size-4"
            /></span>
            <div class="flex min-w-0 grow flex-col gap-1">
              <div class="flex items-start gap-2">
                <NuxtLink :to="`/admin/poster/${p.id}`" class="min-w-0 grow leading-snug font-semibold">{{ p.name }}</NuxtLink>
                <AdminStatusPill :tone="POSTER_STATE[p.state].tone" class="shrink-0">{{ POSTER_STATE[p.state].label }}</AdminStatusPill>
              </div>
              <span class="text-[13px] text-muted-foreground">{{ fmtRange(p.start, p.end) }}</span>
              <span class="truncate text-[13px] text-muted-foreground">{{
                p.kind === 'pengumuman' ? 'Semua halaman' : p.pages.length ? `Di: ${p.pages.map(x => x.name).join(', ')}` : 'Belum dipasang'
              }}</span>
              <div class="mt-1 flex gap-1.5">
                <Button as-child variant="outline" class="h-10"><NuxtLink :to="`/admin/poster/${p.id}`">Ubah</NuxtLink></Button>
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="icon" class="size-10" :aria-label="`Aksi lain untuk ${p.name}`"
                      ><Ellipsis class="size-4"
                    /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem class="min-h-11" @select="duplicate(p.id)"><Copy class="size-4" />Duplikat</DropdownMenuItem>
                    <DropdownMenuItem v-if="!p.archived" class="min-h-11" @select="toArchive = p"
                      ><Archive class="size-4" />Arsipkan</DropdownMenuItem
                    >
                    <DropdownMenuItem v-else class="min-h-11" @select="setArchived(p, false)"
                      ><RotateCcw class="size-4" />Pulihkan</DropdownMenuItem
                    >
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </li>
        </ul>
        <Table class="hidden min-w-[860px] md:table">
          <TableHeader>
            <TableRow>
              <TableHead class="pl-4">Poster</TableHead><TableHead>Status</TableHead><TableHead>Jadwal tayang</TableHead>
              <TableHead>Dipakai di</TableHead><TableHead>Terakhir diubah</TableHead><TableHead class="pr-4 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="p in rows" :key="p.id">
              <TableCell class="pl-4">
                <div class="flex items-center gap-3">
                  <img v-if="p.imageUrl" :src="p.imageUrl" alt="" class="h-12 w-10 rounded object-cover" loading="lazy" />
                  <span v-else class="flex h-12 w-10 items-center justify-center rounded bg-amber-100 text-amber-800"
                    ><Megaphone class="size-4"
                  /></span>
                  <div>
                    <NuxtLink :to="`/admin/poster/${p.id}`" class="font-medium hover:underline">{{ p.name }}</NuxtLink>
                    <div class="text-xs text-muted-foreground">{{ p.kind === 'gambar' ? 'Poster gambar' : 'Pengumuman penting' }}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell
                ><AdminStatusPill :tone="POSTER_STATE[p.state].tone">{{ POSTER_STATE[p.state].label }}</AdminStatusPill></TableCell
              >
              <TableCell class="text-zinc-700">{{ fmtRange(p.start, p.end) }}</TableCell>
              <TableCell class="text-sm">
                <span v-if="p.kind === 'pengumuman'" class="text-muted-foreground">Semua halaman</span>
                <span v-else-if="!p.pages.length" class="text-muted-foreground italic">Belum dipasang</span>
                <span v-else>{{ p.pages.map(x => x.name).join(', ') }}</span>
              </TableCell>
              <TableCell class="text-[13px] text-muted-foreground">{{ fmtDateTime(p.updatedAt) }}<br />{{ p.updatedByName }}</TableCell>
              <TableCell class="pr-4">
                <div class="flex justify-end gap-1">
                  <Button as-child variant="ghost" size="icon" class="size-9"
                    ><NuxtLink :to="`/admin/poster/${p.id}`" :aria-label="`Ubah ${p.name}`"><Pencil class="size-4" /></NuxtLink
                  ></Button>
                  <Button variant="ghost" size="icon" class="size-9" :aria-label="`Duplikat ${p.name}`" @click="duplicate(p.id)"
                    ><Copy class="size-4"
                  /></Button>
                  <Button
                    v-if="!p.archived"
                    variant="ghost"
                    size="icon"
                    class="size-9"
                    :aria-label="`Arsipkan ${p.name}`"
                    @click="toArchive = p"
                    ><Archive class="size-4"
                  /></Button>
                  <Button
                    v-else
                    variant="ghost"
                    size="icon"
                    class="size-9"
                    :aria-label="`Pulihkan ${p.name}`"
                    @click="setArchived(p, false)"
                    ><RotateCcw class="size-4"
                  /></Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </AdminDataState>
    </Card>

    <AdminConfirmDialog
      v-model:open="archiveOpen"
      destructive
      :title="`Arsipkan “${toArchive?.name}”?`"
      :description="archiveText"
      confirm-label="Ya, arsipkan"
      @confirm="toArchive && setArchived(toArchive, true)"
    />
  </div>
</template>
