<script setup lang="ts">
import { ChevronDown, ChevronUp, Ellipsis, GripVertical, Plus, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Page, Poster, PosterState } from '#shared/types'
import { POSTER_STATE } from '#shared/constants'

definePageMeta({ layout: 'admin', middleware: 'auth', title: 'Halaman' })

type PageRow = Page & { cardCount: number }
type PosterRow = Poster & { state: PosterState }
const { data: pages, refresh: refreshPages, status } = useFetch<PageRow[]>('/api/pages', { server: false })
const { data: posters } = useFetch<PosterRow[]>('/api/posters', { server: false })

const selectedId = ref('pg1')
const page = computed(() => pages.value?.find(p => p.id === selectedId.value))
const order = ref<string[]>([])
watch(
  page,
  p => {
    if (p) order.value = [...p.posterIds]
  },
  { immediate: true },
)
const dirty = computed(() => !!page.value && order.value.join() !== page.value.posterIds.join())

const byId = (id: string) => posters.value?.find(p => p.id === id)
const blocks = computed(() => order.value.map(byId).filter((p): p is PosterRow => !!p))
const addable = computed(() => (posters.value ?? []).filter(p => p.kind === 'gambar' && !p.archived && !order.value.includes(p.id)))
const announcement = computed(() => posters.value?.find(p => p.kind === 'pengumuman' && p.state === 'tayang'))

function move(i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= order.value.length) return
  const n = [...order.value]
  ;[n[i], n[j]] = [n[j]!, n[i]!]
  order.value = n
}
// Native drag & drop as an alternative to the arrow buttons.
const dragFrom = ref<number | null>(null)
function onDrop(i: number) {
  if (dragFrom.value === null || dragFrom.value === i) return
  const n = [...order.value]
  const [item] = n.splice(dragFrom.value, 1)
  n.splice(i, 0, item!)
  order.value = n
  dragFrom.value = null
}

const showAdd = ref(false)
function addPoster(id: string) {
  order.value.push(id)
  showAdd.value = false
}
// Switching pages resets the order list, so unsaved changes are confirmed first.
const switchTo = ref<string | null>(null)
const switchOpen = computed({
  get: () => !!switchTo.value,
  set: v => {
    if (!v) switchTo.value = null
  },
})
const switchName = computed(() => pages.value?.find(p => p.id === switchTo.value)?.name ?? '')
function selectPage(id: string) {
  if (id === selectedId.value) return
  if (dirty.value) switchTo.value = id
  else selectedId.value = id
}
async function resolveSwitch(keep: boolean) {
  const id = switchTo.value
  if (!id) return
  if (keep) await save()
  switchTo.value = null
  selectedId.value = id
}
onBeforeRouteLeave(() => {
  if (dirty.value && !window.confirm('Tinggalkan tanpa menyimpan? Urutan poster yang belum disimpan akan hilang.')) return false
})

const showNew = ref(false)
async function onCreated(created: Page) {
  await refreshPages()
  selectPage(created.id)
}
const confirmDefault = ref(false)
async function save(extra: Partial<Page> = {}) {
  if (!page.value) return
  await $fetch(`/api/pages/${page.value.id}`, { method: 'PUT', body: { posterIds: order.value, ...extra } })
  await refreshPages()
  toast.success(
    extra.isDefault
      ? 'Halaman umum default diganti.'
      : extra.status === 'published'
        ? 'Halaman diterbitkan. Kartu yang dipetakan langsung menampilkan versi baru.'
        : 'Urutan poster disimpan.',
  )
}

const TONE: Record<PosterState, string> = {
  tayang: '',
  terjadwal: 'opacity-60',
  draft: 'opacity-60',
  berakhir: 'opacity-60',
  arsip: 'opacity-60',
}
const preview = usePosterPreview(() => ({
  announcements: announcement.value ? [announcement.value] : [],
  posters: blocks.value.filter(p => p.state === 'tayang'),
}))
</script>

<template>
  <div>
    <AdminPageHeader title="Halaman" description="Halaman adalah poster yang dibuka kartu NFC. Susun urutan poster, lalu terbitkan.">
      <Button class="h-11" @click="save({ status: 'published' })">{{ dirty ? 'Simpan & terbitkan' : 'Terbitkan halaman' }}</Button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="icon" class="size-11" aria-label="Opsi halaman lainnya"><Ellipsis class="size-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-64">
          <DropdownMenuItem class="min-h-11 flex-col items-start gap-0" :disabled="page?.isDefault" @select="confirmDefault = true">
            <span class="font-semibold">Jadikan halaman umum</span>
            <span class="text-xs text-muted-foreground">{{
              page?.isDefault ? 'Halaman ini sudah halaman umum' : 'Untuk kartu nonaktif atau belum dipetakan'
            }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </AdminPageHeader>

    <AdminTableSkeleton v-if="status === 'pending'" />
    <div v-else class="flex flex-wrap items-start gap-6">
      <nav aria-label="Daftar halaman" class="flex w-full flex-col gap-2 md:w-60">
        <div class="flex items-center justify-between">
          <b class="text-sm font-semibold">Halaman ({{ pages?.length }})</b>
          <Button
            variant="outline"
            size="icon"
            class="size-9"
            aria-label="Buat halaman baru"
            title="Buat halaman baru"
            @click="showNew = true"
            ><Plus class="size-4"
          /></Button>
        </div>
        <button
          v-for="p in pages"
          :key="p.id"
          type="button"
          :aria-current="p.id === selectedId ? 'page' : undefined"
          :class="['rounded-xl p-3 text-left', p.id === selectedId ? 'border-2 border-primary' : 'border']"
          @click="selectPage(p.id)"
        >
          <b class="text-sm font-semibold">{{ p.name }}</b>
          <div class="text-xs text-muted-foreground">{{ p.posterIds.length }} poster · {{ p.cardCount }} kartu</div>
          <AdminStatusPill v-if="p.isDefault" class="mt-1.5">Halaman umum default</AdminStatusPill>
          <AdminStatusPill v-else-if="p.status === 'draft'" tone="warning" class="mt-1.5">Draft</AdminStatusPill>
        </button>
      </nav>

      <Card class="min-w-0 grow-[999] basis-96 gap-3 p-5">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-base font-semibold">Urutan poster</h2>
          <Button variant="outline" class="h-10" :disabled="!addable.length" @click="showAdd = !showAdd">
            <Plus class="size-4" />Tambah poster
          </Button>
        </div>
        <p class="text-[13px] text-muted-foreground">
          Seret pegangan atau pakai tombol panah. Pengumuman penting selalu tampil paling atas.
        </p>
        <div v-if="announcement" class="rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
          Pengumuman aktif: “{{ announcement.name }}” · tetap di atas
        </div>
        <div v-if="showAdd" class="flex flex-col gap-1 rounded-lg border bg-secondary p-2">
          <button
            v-for="p in addable"
            :key="p.id"
            type="button"
            class="flex min-h-11 items-center gap-3 rounded-md px-2 text-left text-sm hover:bg-background"
            @click="addPoster(p.id)"
          >
            <img :src="p.imageUrl" alt="" class="h-10 w-8 rounded object-cover" /><span class="grow">{{ p.name }}</span>
            <AdminStatusPill>{{ POSTER_STATE[p.state].label }}</AdminStatusPill>
          </button>
        </div>
        <AdminEmptyState
          v-if="!blocks.length"
          title="Halaman ini belum berisi poster"
          :description="
            page?.isDefault
              ? 'Halaman umum menampilkan sambutan dan tombol kontak saja.'
              : 'Tambahkan poster agar kartu menampilkan sesuatu.'
          "
        />
        <div
          v-if="dirty"
          role="status"
          class="flex flex-wrap items-center gap-2.5 rounded-lg border border-ring bg-secondary py-2 pr-2 pl-3.5 text-sm"
        >
          <span class="min-w-48 grow text-secondary-foreground"
            ><b class="font-semibold">Urutan berubah, belum disimpan.</b> Pengunjung masih melihat urutan lama.</span
          >
          <Button variant="outline" class="h-10" @click="order = [...(page?.posterIds ?? [])]">Batalkan</Button>
          <Button class="h-10" @click="save()">Simpan urutan</Button>
        </div>
        <ol class="flex flex-col gap-2">
          <li
            v-for="(p, i) in blocks"
            :key="p.id"
            draggable="true"
            :class="['flex items-center gap-2 rounded-xl border bg-background py-1.5 pr-2 pl-1', dragFrom === i && 'opacity-50']"
            @dragstart="dragFrom = i"
            @dragover.prevent
            @drop="onDrop(i)"
          >
            <span
              class="flex h-11 w-8 cursor-grab items-center justify-center text-zinc-500"
              :aria-label="`Seret untuk memindahkan ${p.name}`"
            >
              <GripVertical class="size-4" />
            </span>
            <span class="w-5 text-center text-[13px] text-muted-foreground">{{ i + 1 }}</span>
            <img :src="p.imageUrl" alt="" :class="['h-12 w-10 rounded object-cover', TONE[p.state]]" />
            <div class="min-w-0 grow">
              <b class="block truncate text-sm font-medium">{{ p.name }}</b>
              <span class="text-xs text-muted-foreground">{{
                p.state === 'tayang'
                  ? 'Sedang tayang'
                  : `Tidak tampil
                sekarang · ${POSTER_STATE[p.state].label}`
              }}</span>
            </div>
            <Button variant="outline" size="icon" class="size-9" :disabled="i === 0" :aria-label="`Naikkan ${p.name}`" @click="move(i, -1)">
              <ChevronUp class="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              class="size-9"
              :disabled="i === blocks.length - 1"
              :aria-label="`Turunkan ${p.name}`"
              @click="move(i, 1)"
            >
              <ChevronDown class="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="size-9 text-muted-foreground"
              :aria-label="`Lepas ${p.name} dari halaman`"
              @click="order.splice(i, 1)"
            >
              <X class="size-4" />
            </Button>
          </li>
        </ol>
      </Card>

      <aside aria-label="Pratinjau HP" class="flex basis-80 grow flex-col items-center gap-2">
        <AdminPhoneFrame>
          <PosterView v-if="preview" :view="preview" preview class="min-h-full" />
        </AdminPhoneFrame>
        <span class="text-center text-xs text-muted-foreground"
          >Hanya poster yang sedang tayang yang tampil. Pratinjau mengikuti urutan di layar, termasuk yang belum disimpan.</span
        >
      </aside>
    </div>

    <AlertDialog v-model:open="switchOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Simpan urutan “{{ page?.name }}” dulu?</AlertDialogTitle>
          <AlertDialogDescription
            >Anda mengubah urutan poster tapi belum menyimpannya. Bila pindah ke “{{ switchName }}” tanpa menyimpan, perubahan ini
            hilang.</AlertDialogDescription
          >
        </AlertDialogHeader>
        <AlertDialogFooter class="flex-wrap">
          <Button variant="outline" class="h-11" @click="switchTo = null">Tetap di sini</Button>
          <Button variant="outline" class="h-11 text-destructive hover:text-destructive" @click="resolveSwitch(false)"
            >Buang perubahan</Button
          >
          <Button class="h-11" @click="resolveSwitch(true)">Simpan &amp; pindah</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AdminNewPageDialog v-model:open="showNew" @created="onCreated" />
    <AdminConfirmDialog
      v-model:open="confirmDefault"
      :title="`Jadikan “${page?.name}” halaman umum default?`"
      confirm-label="Ya, jadikan default"
      description="Semua kartu yang nonaktif atau belum dipetakan akan menampilkan halaman ini. Halaman umum sebaiknya berisi informasi umum saja."
      @confirm="save({ isDefault: true })"
    />
  </div>
</template>
