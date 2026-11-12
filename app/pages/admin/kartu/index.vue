<script setup lang="ts">
import { Ellipsis, Nfc, Plus, Power, PowerOff, QrCode } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CardRow } from '~/composables/useCards'
import type { Page } from '#shared/types'
import { WRITE_STATUS } from '#shared/constants'
import { fmtDate, fmtDateTime } from '#shared/utils/format'

definePageMeta({ layout: 'admin', middleware: 'auth', title: 'Kartu NFC' })

const { isSuper } = useSession()
const { cards, status, refresh, bulk } = useCards()
const { data: pages } = useFetch<Page[]>('/api/pages', { server: false })

// ---- Filters -------------------------------------------------------------
const q = ref('')
const fStatus = ref('')
const fGroup = ref('')
const groups = computed(() => [...new Set((cards.value ?? []).map(c => c.group))])
const rows = computed(() =>
  (cards.value ?? []).filter(
    c =>
      (!q.value || `${c.code} ${c.label}`.toLowerCase().includes(q.value.toLowerCase())) &&
      (!fGroup.value || c.group === fGroup.value) &&
      (!fStatus.value ||
        (fStatus.value === 'unmapped' ? !c.pageId : fStatus.value === 'belum' ? c.writeStatus !== 'sudah' : c.status === fStatus.value)),
  ),
)
const unwritten = computed(() => (cards.value ?? []).filter(c => c.writeStatus !== 'sudah').length)

// ---- Selection -----------------------------------------------------------
const selected = ref<string[]>([])
const allChecked = computed(() => rows.value.length > 0 && rows.value.every(r => selected.value.includes(r.code)))
function toggleAll() {
  selected.value = allChecked.value ? [] : rows.value.map(r => r.code)
}

// ---- Dialogs -------------------------------------------------------------
const mapCodes = ref<string[]>([])
const mapOpen = ref(false)
const mapInitial = ref<string | null>(null)
function openMap(codes: string[], current: string | null = null) {
  mapCodes.value = codes
  mapInitial.value = current
  mapOpen.value = true
}
async function doMap(pageId: string | null) {
  const pageName = pages.value?.find(p => p.id === pageId)?.name
  if (await bulk('map', mapCodes.value, pageId, pageName)) selected.value = []
  mapOpen.value = false
}

const deactCodes = ref<string[]>([])
const deactOpen = ref(false)
function askDeactivate(codes: string[] = selected.value) {
  deactCodes.value = [...codes]
  deactOpen.value = true
}
async function doDeactivate() {
  if (await bulk('deactivate', deactCodes.value)) selected.value = []
}

const registerOpen = ref(false)
const qrCard = ref<CardRow | null>(null)
const qrOpen = computed({
  get: () => !!qrCard.value,
  set: v => {
    if (!v) qrCard.value = null
  },
})

function exportCsv() {
  downloadCsv('kartu-nfc.csv', [
    ['kode', 'label', 'kelompok', 'halaman', 'status', 'status_tulis', 'alamat'],
    ...(cards.value ?? []).map(c => [c.code, c.label, c.group, c.pageName ?? '', c.status, c.writeStatus, c.url]),
  ])
}
</script>

<template>
  <div>
    <AdminPageHeader
      title="Kartu NFC"
      description="Setiap kartu menyimpan satu alamat unik. Tentukan halaman yang muncul saat kartu diketuk."
    >
      <Button variant="outline" class="h-11" :disabled="!cards?.length" @click="exportCsv">Ekspor CSV</Button>
      <Button as-child variant="outline" class="h-11">
        <NuxtLink to="/admin/kartu/tulis"
          ><Nfc class="size-4" />Tulis ke kartu
          <span class="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{{ unwritten }}</span></NuxtLink
        >
      </Button>
      <Button v-if="isSuper" class="h-11" @click="registerOpen = true"><Plus class="size-4" />Daftarkan kartu</Button>
    </AdminPageHeader>

    <p v-if="!isSuper" class="mb-4 rounded-lg border bg-secondary px-4 py-3 text-sm text-zinc-700">
      Anda dapat melihat kartu, memetakan kartu ke halaman, menulis kartu, dan membuka QR cadangan. Pendaftaran dan penonaktifan kartu
      dilakukan Super Admin.
    </p>

    <div class="mb-4 flex flex-wrap gap-3">
      <Input
        v-model="q"
        type="search"
        aria-label="Cari kartu"
        placeholder="Cari kode atau lokasi kartu…"
        class="h-11 min-w-60 grow basis-60"
      />
      <AdminNativeSelect v-model="fStatus" aria-label="Status">
        <option value="">Semua status</option>
        <option value="aktif">Aktif</option>
        <option value="nonaktif">Nonaktif</option>
        <option value="unmapped">Belum dipetakan</option>
        <option value="belum">Belum ditulis</option>
      </AdminNativeSelect>
      <AdminNativeSelect v-model="fGroup" aria-label="Kelompok">
        <option value="">Semua kelompok</option>
        <option v-for="g in groups" :key="g" :value="g">{{ g }}</option>
      </AdminNativeSelect>
    </div>

    <div
      v-if="selected.length"
      role="region"
      aria-label="Aksi massal"
      class="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-primary py-2 pr-2 pl-4 text-sm text-primary-foreground"
    >
      <b class="grow font-medium">{{ selected.length }} kartu dipilih</b>
      <Button
        variant="outline"
        class="h-10 border-zinc-600 bg-transparent text-white hover:bg-white/10 hover:text-white"
        @click="openMap([...selected])"
        >Petakan ke halaman…</Button
      >
      <Button as-child variant="outline" class="h-10 border-zinc-600 bg-transparent text-white hover:bg-white/10 hover:text-white"
        ><NuxtLink to="/admin/kartu/tulis">Tulis ke kartu</NuxtLink></Button
      >
      <Button v-if="isSuper" variant="destructive" class="h-10" @click="askDeactivate()">Nonaktifkan</Button>
      <Button variant="ghost" class="h-10 text-zinc-300 hover:bg-white/10 hover:text-white" @click="selected = []">Batalkan pilihan</Button>
    </div>

    <Card class="overflow-hidden py-0">
      <AdminDataState
        :status="status"
        :empty="!rows.length"
        :empty-icon="Nfc"
        empty-title="Tidak ada kartu"
        :empty-description="cards?.length ? 'Coba kata kunci lain atau hapus filter.' : 'Daftarkan kartu NFC pertama Anda.'"
        @retry="refresh()"
      >
        <Table class="min-w-[860px]">
          <TableHeader>
            <TableRow>
              <TableHead class="w-12 pl-4"
                ><input
                  type="checkbox"
                  class="size-[18px] accent-primary"
                  :checked="allChecked"
                  aria-label="Pilih semua kartu"
                  @change="toggleAll"
              /></TableHead>
              <TableHead>Kode kartu</TableHead><TableHead>Lokasi / label</TableHead><TableHead>Halaman tujuan</TableHead>
              <TableHead>Status</TableHead><TableHead>Tap terakhir</TableHead><TableHead class="pr-4 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="c in rows" :key="c.code" :data-state="selected.includes(c.code) ? 'selected' : undefined">
              <TableCell class="pl-4"
                ><label class="flex h-11 w-8 items-center"
                  ><input
                    v-model="selected"
                    type="checkbox"
                    :value="c.code"
                    class="size-[18px] accent-primary"
                    :aria-label="`Pilih kartu ${c.code}`" /></label
              ></TableCell>
              <TableCell class="font-mono text-[13px] tracking-wide">{{ c.code }}</TableCell>
              <TableCell
                >{{ c.label }}
                <div class="text-xs text-muted-foreground">{{ c.group }}</div></TableCell
              >
              <TableCell :class="!c.pageName && 'text-muted-foreground italic'">{{ c.pageName ?? 'Halaman umum (default)' }}</TableCell>
              <TableCell>
                <AdminStatusPill :tone="c.status === 'nonaktif' ? 'danger' : !c.pageId ? 'warning' : 'success'">{{
                  c.status === 'nonaktif' ? 'Nonaktif' : !c.pageId ? 'Belum dipetakan' : 'Aktif'
                }}</AdminStatusPill>
                <div :class="['mt-1 text-xs', c.writeStatus === 'gagal' ? 'font-semibold text-destructive' : 'text-muted-foreground']">
                  {{ WRITE_STATUS[c.writeStatus].label }} ·
                  {{
                    c.writtenAt
                      ? `${fmtDate(c.writtenAt)}${c.locked ? ' · terkunci' : ''}`
                      : c.writeStatus === 'gagal'
                        ? 'kartu bergeser, coba lagi'
                        : 'masih kosong'
                  }}
                </div>
                <NuxtLink
                  v-if="c.writeStatus !== 'sudah'"
                  to="/admin/kartu/tulis"
                  class="inline-flex min-h-7 items-center text-xs font-semibold text-primary underline-offset-4 hover:underline"
                  >Tulis ke kartu</NuxtLink
                >
              </TableCell>
              <TableCell class="text-[13px] text-muted-foreground">{{ c.lastTap ? fmtDateTime(c.lastTap) : 'Belum pernah' }}</TableCell>
              <TableCell class="pr-4">
                <div class="flex justify-end gap-1">
                  <Button variant="outline" size="sm" class="h-9" @click="openMap([c.code], c.pageId)">Petakan</Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" class="size-9" :aria-label="`Aksi lain untuk kartu ${c.code}`"
                        ><Ellipsis class="size-4"
                      /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-52">
                      <DropdownMenuItem as-child class="min-h-11"
                        ><NuxtLink to="/admin/kartu/tulis"><Nfc class="size-4" />Tulis ke kartu</NuxtLink></DropdownMenuItem
                      >
                      <DropdownMenuItem class="min-h-11" @select="qrCard = c"><QrCode class="size-4" />QR cadangan</DropdownMenuItem>
                      <template v-if="isSuper">
                        <DropdownMenuSeparator />
                        <DropdownMenuItem v-if="c.status === 'nonaktif'" class="min-h-11" @select="bulk('activate', [c.code])"
                          ><Power class="size-4" />Aktifkan</DropdownMenuItem
                        >
                        <DropdownMenuItem v-else class="min-h-11 text-destructive focus:text-destructive" @select="askDeactivate([c.code])"
                          ><PowerOff class="size-4" />Nonaktifkan</DropdownMenuItem
                        >
                      </template>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </AdminDataState>
    </Card>
    <p class="mt-3 text-[13px] text-muted-foreground">Kartu “Belum ditulis” masih kosong dan belum bisa diketuk.</p>

    <CardMapDialog v-model:open="mapOpen" :count="mapCodes.length" :pages="pages ?? []" :initial-page-id="mapInitial" @confirm="doMap" />
    <AdminConfirmDialog
      v-model:open="deactOpen"
      destructive
      :title="`Nonaktifkan ${deactCodes.length} kartu?`"
      confirm-label="Ya, nonaktifkan"
      description="Gunakan ini untuk kartu yang hilang atau rusak. Siapa pun yang mengetuk kartu ini akan melihat halaman umum, bukan poster. Data tap lama tetap tersimpan, dan Anda bisa mengaktifkannya lagi kapan saja."
      @confirm="doDeactivate"
    />
    <CardRegisterDialog v-model:open="registerOpen" :pages="pages ?? []" :groups="groups" @registered="refresh()" />
    <CardQrDialog v-if="qrCard" v-model:open="qrOpen" :code="qrCard.code" :url="qrCard.url" />
  </div>
</template>
