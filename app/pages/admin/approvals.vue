<script setup lang="ts">
// Approvers (and Super Admins) review what Staff and Marketing submitted: what changes compared with
// the live version, a phone preview of the submitted version, then approve or reject with a reason.
import { Check, ClipboardCheck, Megaphone, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Page, Poster, PosterState } from '#shared/types'
import { ANNOUNCEMENT_LEVEL, CONTACT_BUTTON, POSTER_CATEGORY } from '#shared/constants'
import { fmtDateTime, fmtRange } from '#shared/utils/format'

definePageMeta({ layout: 'admin', middleware: 'auth', title: 'Persetujuan', approverOnly: true })

type Row = Poster & {
  state: PosterState
  pages: { id: string; name: string }[]
  ownerName: string | null
  pendingByName: string | null
}
const { data, status, refresh } = useFetch<Row[]>('/api/posters', { server: false })
const { data: pageList } = useFetch<Page[]>('/api/pages', { server: false })
const { marketers } = useMarketingUsers()

/** Oldest first: whoever waited longest is reviewed first. */
const queue = computed(() =>
  (data.value ?? [])
    .filter(p => p.pending && !p.archived)
    .sort((a, b) => a.pending!.at.localeCompare(b.pending!.at)),
)
const selectedId = ref('')
watch(
  queue,
  list => {
    if (!list.some(p => p.id === selectedId.value)) selectedId.value = list[0]?.id ?? ''
  },
  { immediate: true },
)
const item = computed(() => queue.value.find(p => p.id === selectedId.value))
/** The poster as it will look once approved. */
const proposed = computed(() =>
  item.value ? { ...item.value, ...item.value.pending!.fields } : null,
)
const isNew = computed(() => item.value?.status !== 'published')

// ---- What changes -----------------------------------------------------------------------------
const pageName = (id: string) => pageList.value?.find(p => p.id === id)?.name ?? id
const ownerName = (id: string | null | undefined) =>
  !id
    ? 'Belum ditentukan'
    : (marketers.value.find(m => m.id === id)?.name ??
      (id === item.value?.ownerId ? item.value?.ownerName : null) ??
      'Pengguna lain')
const show = (v: unknown) => (v === undefined || v === null || v === '' ? '–' : String(v))

const changes = computed(() => {
  const live = item.value
  const next = proposed.value
  if (!live || !next) return []
  const rows: { label: string; before: string; after: string }[] = []
  const add = (label: string, before: string, after: string) => {
    if (before !== after) rows.push({ label, before, after })
  }
  add(
    'Status',
    live.status === 'published' ? 'Terbit' : 'Draft',
    next.status === 'published' ? 'Terbit' : 'Draft',
  )
  add('Jadwal tayang', fmtRange(live.start, live.end), fmtRange(next.start, next.end))
  if (live.kind === 'pengumuman') {
    add('Teks pengumuman', show(live.text), show(next.text))
    add(
      'Warna bar',
      live.level ? ANNOUNCEMENT_LEVEL[live.level].label : '–',
      next.level ? ANNOUNCEMENT_LEVEL[next.level].label : '–',
    )
    return rows
  }
  add(
    'Gambar',
    live.imageUrl === next.imageUrl ? '' : 'Gambar lama',
    live.imageUrl === next.imageUrl ? '' : 'Gambar baru',
  )
  add('Judul', show(live.title), show(next.title))
  add(
    'Kategori',
    live.category ? POSTER_CATEGORY[live.category] : '–',
    next.category ? POSTER_CATEGORY[next.category] : '–',
  )
  add('Penjelasan', show(live.description), show(next.description))
  add(
    'Harga',
    show([live.price, live.priceUnit].filter(Boolean).join(' / ')),
    show([next.price, next.priceUnit].filter(Boolean).join(' / ')),
  )
  add('Judul daftar', show(live.listTitle), show(next.listTitle))
  add('Daftar poin', show(live.points?.join(' · ')), show(next.points?.join(' · ')))
  add('Syarat & ketentuan', show(live.terms), show(next.terms))
  add(
    'Tombol kontak',
    (live.buttons ?? []).map(b => CONTACT_BUTTON[b]).join(', ') || '–',
    (next.buttons ?? []).map(b => CONTACT_BUTTON[b]).join(', ') || '–',
  )
  add(
    'Brosur',
    live.brochureUrl ? (live.brochureFile ?? 'Ada') : '–',
    next.brochureUrl ? (next.brochureFile ?? 'Ada') : '–',
  )
  add('Marketing', ownerName(live.ownerId), ownerName(next.ownerId))
  const pagesNow = live.pages.map(p => p.name).join(', ') || 'Belum dipasang'
  const pagesNext = item.value!.pending!.pageIds
  add(
    'Halaman',
    pagesNow,
    pagesNext ? pagesNext.map(pageName).join(', ') || 'Belum dipasang' : pagesNow,
  )
  return rows.filter(r => r.before || r.after)
})

const preview = usePosterPreview(() => {
  const next = proposed.value
  if (!next) return { posters: [] }
  const contactName = marketers.value.find(m => m.id === next.ownerId)?.name
  return next.kind === 'pengumuman'
    ? { posters: [], announcements: [next] }
    : { posters: [{ ...next, contactName }] }
})

// ---- Approve / reject -------------------------------------------------------------------------
const busy = ref(false)
async function done(message: string) {
  await Promise.all([refresh(), refreshNuxtData('sidebar-dash')])
  toast.success(message)
}
async function approve() {
  const p = item.value
  if (!p || busy.value) return
  busy.value = true
  try {
    const url: string = `/api/posters/${p.id}/approve`
    await $fetch(url, { method: 'POST' })
    await done(
      proposed.value?.status === 'published'
        ? `“${p.name}” disetujui dan tampil sesuai jadwal.`
        : `“${p.name}” disetujui.`,
    )
  } catch (e: any) {
    toast.error(e?.data?.statusMessage ?? 'Belum bisa menyetujui. Coba lagi.')
    await refresh()
  } finally {
    busy.value = false
  }
}

const rejectOpen = ref(false)
const note = ref('')
const { errors, submit } = useFieldErrors()
function askReject() {
  note.value = ''
  errors.value = {}
  rejectOpen.value = true
}
async function reject() {
  const p = item.value
  if (!p || busy.value) return
  busy.value = true
  const url: string = `/api/posters/${p.id}/reject`
  const res = await submit(() =>
    $fetch<Poster>(url, { method: 'POST', body: { note: note.value } }),
  )
  busy.value = false
  if (!res) return
  rejectOpen.value = false
  await done(
    `Pengajuan “${p.name}” ditolak. ${p.pendingByName ?? 'Pengaju'} akan melihat alasannya.`,
  )
}
</script>

<template>
  <div>
    <AdminPageHeader
      title="Persetujuan"
      description="Poster dan pengumuman dari Staff Konten dan Marketing tampil setelah disetujui. Sampai saat itu pengunjung tetap melihat versi lama."
    />

    <AdminTableSkeleton v-if="status === 'pending' && !data" :rows="4" />
    <AdminEmptyState
      v-else-if="status === 'error'"
      error
      title="Data gagal dimuat"
      description="Periksa koneksi internet Anda, lalu coba lagi."
    >
      <Button class="h-11" @click="refresh()">Coba lagi</Button>
    </AdminEmptyState>
    <AdminEmptyState
      v-else-if="!queue.length"
      :icon="ClipboardCheck"
      title="Tidak ada yang menunggu persetujuan"
      description="Pengajuan baru dari Staff Konten dan Marketing akan muncul di sini."
    />

    <div v-else class="flex flex-wrap items-start gap-6">
      <nav aria-label="Daftar pengajuan" class="flex w-full flex-col gap-2 md:w-72">
        <b class="text-sm font-semibold">Menunggu ({{ queue.length }})</b>
        <button
          v-for="p in queue"
          :key="p.id"
          type="button"
          :aria-current="p.id === selectedId ? 'true' : undefined"
          :class="[
            'flex min-h-14 gap-3 rounded-xl p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            p.id === selectedId ? 'border-2 border-primary' : 'border',
          ]"
          @click="selectedId = p.id"
        >
          <img
            v-if="p.kind === 'gambar' && (p.pending!.fields.imageUrl || p.imageUrl)"
            :src="p.pending!.fields.imageUrl || p.imageUrl"
            alt=""
            class="h-14 w-11 shrink-0 rounded bg-muted object-cover"
          />
          <span
            v-else
            class="flex h-14 w-11 shrink-0 items-center justify-center rounded bg-amber-100 text-amber-800"
          >
            <Megaphone class="size-4" aria-hidden="true" />
          </span>
          <span class="min-w-0">
            <b class="block truncate text-sm font-semibold">
              {{ p.pending!.fields.name || p.name }}
            </b>
            <span class="block text-xs text-muted-foreground">
              {{ p.status === 'published' ? 'Perubahan' : 'Baru' }} ·
              {{ p.pendingByName ?? 'Pengguna' }}
            </span>
            <span class="block text-xs text-muted-foreground">
              {{ fmtDateTime(p.pending!.at) }}
            </span>
          </span>
        </button>
      </nav>

      <section
        v-if="item && proposed"
        aria-labelledby="review-title"
        class="flex min-w-0 grow-[999] basis-[420px] flex-col gap-4"
      >
        <Card class="gap-4 p-5">
          <div>
            <h2 id="review-title" class="text-lg font-semibold">{{ proposed.name }}</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ item.kind === 'pengumuman' ? 'Pengumuman' : 'Poster' }} ·
              {{
                isNew
                  ? 'baru, belum pernah tayang'
                  : 'perubahan pada versi yang sedang terbit (pengunjung masih melihat versi lama)'
              }}
              · diajukan {{ item.pendingByName ?? 'pengguna' }}, {{ fmtDateTime(item.pending!.at) }}
            </p>
          </div>

          <div v-if="changes.length" class="overflow-x-auto">
            <table class="w-full text-sm">
              <caption class="sr-only">Yang berubah dibanding versi sekarang</caption>
              <thead>
                <tr class="border-b text-left text-muted-foreground">
                  <th scope="col" class="py-2 pr-3 font-medium">Bagian</th>
                  <th scope="col" class="py-2 pr-3 font-medium">Sekarang</th>
                  <th scope="col" class="py-2 font-medium">Diajukan</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in changes" :key="c.label" class="border-b align-top last:border-0">
                  <th scope="row" class="py-2.5 pr-3 text-left font-semibold whitespace-nowrap">
                    {{ c.label }}
                  </th>
                  <td class="py-2.5 pr-3 text-muted-foreground">{{ c.before || '–' }}</td>
                  <td class="py-2.5 font-medium">{{ c.after || '–' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-sm text-muted-foreground">Isinya sama dengan versi sekarang.</p>

          <div class="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button variant="outline" class="h-11" :disabled="busy" @click="askReject">
              <X class="size-4" aria-hidden="true" />
              Tolak…
            </Button>
            <Button class="h-11" :disabled="busy" @click="approve">
              <Check class="size-4" aria-hidden="true" />
              {{
                busy
                  ? 'Menyimpan…'
                  : proposed.status === 'published'
                    ? 'Setujui & terbitkan'
                    : 'Setujui'
              }}
            </Button>
          </div>
        </Card>

        <aside aria-label="Pratinjau HP" class="flex flex-col items-center gap-3">
          <b class="self-stretch text-sm font-semibold">Begini tampilannya setelah disetujui</b>
          <AdminPhoneFrame>
            <PosterView v-if="preview" :view="preview" preview class="min-h-full" />
          </AdminPhoneFrame>
        </aside>
      </section>
    </div>

    <Dialog v-model:open="rejectOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tolak “{{ proposed?.name }}”?</DialogTitle>
          <DialogDescription>
            Pengajuan dibatalkan dan pengunjung tetap melihat versi sekarang.
            {{ item?.pendingByName ?? 'Pengaju' }} melihat alasan ini di formulirnya.
          </DialogDescription>
        </DialogHeader>
        <form id="reject-form" novalidate @submit.prevent="reject">
          <AdminTextField
            id="reject-note"
            v-model="note"
            multiline
            :rows="3"
            label="Alasan"
            required
            :max="300"
            :error="errors.note"
            placeholder="Contoh: Harga belum sesuai brosur terbaru."
          />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" class="h-11" @click="rejectOpen = false">
            Batal
          </Button>
          <Button
            type="submit"
            form="reject-form"
            variant="destructive"
            class="h-11"
            :disabled="busy"
          >
            {{ busy ? 'Menyimpan…' : 'Tolak pengajuan' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
