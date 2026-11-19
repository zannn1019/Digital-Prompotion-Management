<script setup lang="ts">
// Print NFC cards (front with the card's QR code, back with the NFC mark) or QR-only stickers.
// The team's standard design lives in Settings (cardDesign); anyone may adjust it for one print, and a
// Super Admin can save it as the new standard. The QR code is never part of the design.
import { toast } from 'vue-sonner'
import { ImagePlus, Printer, RotateCcw, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { CardDesign, Settings } from '#shared/types'
import { CARD_PRINT } from '#shared/constants'

definePageMeta({ layout: 'admin', middleware: 'auth', title: 'Cetak kartu' })

const route = useRoute()
const { isSuper } = useSession()
const { cards } = useCards()
const { data: settings, refresh: refreshSettings } = useFetch<Settings>('/api/settings', {
  key: 'settings',
  server: false,
})

// ---- What to print ------------------------------------------------------------------------------
const mode = ref<'kartu' | 'qr'>(route.query.mode === 'qr' ? 'qr' : 'kartu')
const layout = ref<'a4' | 'pvc'>('a4')
const sides = ref<'both' | 'front' | 'back'>('both')

const requested = String(route.query.codes ?? '')
  .split(',')
  .filter(Boolean)
const selected = ref<string[]>([])
watch(
  cards,
  list => {
    if (!list || selected.value.length) return
    // From the card list's selection, else every active card.
    selected.value = requested.length
      ? list.filter(c => requested.includes(c.code)).map(c => c.code)
      : list.filter(c => c.status === 'aktif').map(c => c.code)
  },
  { immediate: true },
)
const chosen = computed(() => (cards.value ?? []).filter(c => selected.value.includes(c.code)))
const allChecked = computed(
  () => !!cards.value?.length && selected.value.length === cards.value.length,
)
function toggleAll() {
  selected.value = allChecked.value ? [] : (cards.value ?? []).map(c => c.code)
}

// ---- Design -------------------------------------------------------------------------------------
const design = reactive<CardDesign>({
  frontBg: '#2F318B',
  frontImage: null,
  backBg: '#2F318B',
  backImage: null,
  ink: 'light',
  title: '',
  subtitle: '',
  backCaption: '',
  showLogo: true,
})
const standard = computed(() => settings.value?.cardDesign)
watch(
  standard,
  s => {
    if (s) Object.assign(design, s)
  },
  { immediate: true },
)
const changedFromStandard = computed(
  () => !!standard.value && JSON.stringify(standard.value) !== JSON.stringify({ ...design }),
)
const SWATCHES = [
  { name: 'Biru tua RS', hex: '#2F318B', ink: 'light' as const },
  { name: 'Biru muda', hex: '#00A2E9', ink: 'light' as const },
  { name: 'Hitam', hex: '#18181B', ink: 'light' as const },
  { name: 'Putih', hex: '#FFFFFF', ink: 'dark' as const },
]
function pick(side: 'front' | 'back', s: (typeof SWATCHES)[number]) {
  if (side === 'front') design.frontBg = s.hex
  else design.backBg = s.hex
  design.ink = s.ink
}

const uploading = ref<'' | 'front' | 'back'>('')
const imageError = ref('')
async function uploadBg(side: 'front' | 'back', e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  imageError.value = checkUpload(f, ['image/png', 'image/jpeg', 'image/webp'])
  if (imageError.value) return
  uploading.value = side
  try {
    const { url } = await uploadFile(f, f.name)
    if (side === 'front') design.frontImage = url
    else design.backImage = url
  } catch (err) {
    imageError.value = (err as Error).message
  } finally {
    uploading.value = ''
  }
}

const saving = ref(false)
async function saveStandard() {
  saving.value = true
  try {
    await $fetch('/api/settings', { method: 'PUT', body: { cardDesign: { ...design } } })
    await refreshSettings()
    toast.success('Desain kartu disimpan sebagai standar untuk seluruh tim.')
  } catch (e: any) {
    toast.error(e?.data?.statusMessage ?? 'Desain belum bisa disimpan. Coba lagi.')
  } finally {
    saving.value = false
  }
}
function resetToStandard() {
  if (standard.value) Object.assign(design, standard.value)
}

// ---- Print sheets -------------------------------------------------------------------------------
const PER_SHEET = CARD_PRINT.perSheet
const QR_PER_SHEET = 12
const chunk = <T,>(list: T[], n: number) =>
  Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n))
const sheets = computed(() => chunk(chosen.value, QR_PER_SHEET))
/** The card sides on the A4 sheets, in grid order. With both sides, each card fills one row: front on
 *  the left, back on the right, so a single one-sided page holds both (cut apart, or fold on the middle
 *  line). */
const faceSheets = computed(() => {
  const faces = chosen.value.flatMap(c =>
    sides.value === 'both'
      ? [
          { c, side: 'front' as const },
          { c, side: 'back' as const },
        ]
      : [{ c, side: sides.value as 'front' | 'back' }],
  )
  return chunk(faces, PER_SHEET)
})
// The page size must match the layout, so it is set from here.
useHead(() => ({
  style: [
    {
      key: 'card-print-page',
      // The card size and A4 grid come from CARD_PRINT, so the styles below follow it.
      innerHTML:
        `:root { --card-w: ${CARD_PRINT.widthMm}mm; --card-h: ${CARD_PRINT.heightMm}mm; ` +
        `--card-cols: ${CARD_PRINT.cols}; --card-rows: ${CARD_PRINT.rows} }\n` +
        (mode.value === 'kartu' && layout.value === 'pvc'
          ? `@page { size: ${CARD_PRINT.widthMm}mm ${CARD_PRINT.heightMm}mm; margin: 0 }`
          : '@page { size: A4 portrait; margin: 0 }'),
    },
  ],
}))
const canPrint = computed(() => chosen.value.length > 0)
function print() {
  window.print()
}
const sheetCount = computed(() =>
  mode.value === 'qr'
    ? sheets.value.length
    : layout.value === 'pvc'
      ? chosen.value.length * (sides.value === 'both' ? 2 : 1)
      : faceSheets.value.length,
)
const preview = computed(() => chosen.value[0] ?? cards.value?.[0])
</script>

<template>
  <div>
    <AdminPageHeader
      title="Cetak kartu"
      description="Cetak kartu NFC dengan kode QR-nya, atau stiker QR cadangan. Latar dan tulisan bisa diubah; kode QR selalu tetap agar bisa dipindai."
      :back="{ to: '/admin/nfc-cards', label: 'Kembali ke Kartu NFC' }"
    >
      <Button class="h-11" :disabled="!canPrint" @click="print">
        <Printer class="size-4" />
        Cetak {{ chosen.length }} {{ mode === 'qr' ? 'stiker QR' : 'kartu' }}
      </Button>
    </AdminPageHeader>

    <div class="flex flex-wrap items-start gap-6">
      <!-- Settings -->
      <div class="flex min-w-0 grow basis-[380px] flex-col gap-4">
        <Card class="gap-4 p-5">
          <fieldset class="flex flex-col gap-2">
            <legend class="mb-2 text-sm font-semibold">Yang dicetak</legend>
            <div class="grid gap-2 sm:grid-cols-2">
              <label
                v-for="m in [
                  {
                    v: 'kartu',
                    t: 'Kartu NFC',
                    d: 'Depan: logo, tulisan, QR. Belakang: tanda NFC.',
                  },
                  { v: 'qr', t: 'Stiker QR saja', d: 'QR cadangan untuk HP tanpa NFC.' },
                ] as const"
                :key="m.v"
                :class="[
                  'flex cursor-pointer gap-2.5 rounded-lg p-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-ring',
                  mode === m.v ? 'border-2 border-primary bg-secondary' : 'border',
                ]"
              >
                <input
                  v-model="mode"
                  type="radio"
                  name="mode"
                  :value="m.v"
                  class="mt-0.5 size-[18px] accent-primary"
                />
                <span>
                  <b class="font-semibold">{{ m.t }}</b>
                  <br />
                  <span class="text-muted-foreground">{{ m.d }}</span>
                </span>
              </label>
            </div>
          </fieldset>

          <div v-if="mode === 'kartu'" class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <label for="layout" class="text-sm font-medium">Kertas</label>
              <AdminNativeSelect id="layout" v-model="layout">
                <option value="a4">
                  A4 · {{ CARD_PRINT.perSheet }} kartu per lembar, dengan garis potong
                </option>
                <option value="pvc">
                  1 kartu per halaman ({{ CARD_PRINT.widthMm }} × {{ CARD_PRINT.heightMm }} mm)
                </option>
              </AdminNativeSelect>
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="sides" class="text-sm font-medium">Sisi</label>
              <AdminNativeSelect id="sides" v-model="sides">
                <option value="both">Depan dan belakang</option>
                <option value="front">Depan saja</option>
                <option value="back">Belakang saja</option>
              </AdminNativeSelect>
            </div>
          </div>
        </Card>

        <Card v-if="mode === 'kartu'" class="gap-4 p-5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-base font-semibold">Desain kartu</h2>
            <span v-if="changedFromStandard" class="text-xs text-amber-800">
              Berbeda dari desain standar
            </span>
          </div>
          <div v-for="side in ['front', 'back'] as const" :key="side" class="flex flex-col gap-2">
            <span class="text-sm font-medium">
              Latar {{ side === 'front' ? 'depan' : 'belakang' }}
            </span>
            <div class="flex flex-wrap items-center gap-2">
              <button
                v-for="s in SWATCHES"
                :key="s.hex"
                type="button"
                :aria-label="`${s.name} untuk latar ${side === 'front' ? 'depan' : 'belakang'}`"
                :aria-pressed="
                  (side === 'front' ? design.frontBg : design.backBg).toUpperCase() === s.hex
                "
                :class="[
                  'size-10 rounded-full border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  (side === 'front' ? design.frontBg : design.backBg).toUpperCase() === s.hex &&
                    'ring-2 ring-primary ring-offset-2',
                ]"
                :style="{ background: s.hex }"
                @click="pick(side, s)"
              />
              <label class="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                Warna lain
                <input
                  type="color"
                  class="size-6 cursor-pointer"
                  :value="side === 'front' ? design.frontBg : design.backBg"
                  @input="
                    e => {
                      const v = (e.target as HTMLInputElement).value.toUpperCase()
                      if (side === 'front') design.frontBg = v
                      else design.backBg = v
                    }
                  "
                />
              </label>
              <label
                class="flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-ring"
              >
                <ImagePlus class="size-4" />
                {{ uploading === side ? 'Mengunggah…' : 'Gambar latar' }}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  class="sr-only"
                  @change="uploadBg(side, $event)"
                />
              </label>
              <Button
                v-if="side === 'front' ? design.frontImage : design.backImage"
                variant="ghost"
                class="h-10"
                @click="side === 'front' ? (design.frontImage = null) : (design.backImage = null)"
              >
                <X class="size-4" />
                Hapus gambar
              </Button>
            </div>
          </div>
          <p v-if="imageError" class="text-sm font-medium text-destructive">{{ imageError }}</p>

          <fieldset class="flex flex-col gap-2">
            <legend class="mb-1 text-sm font-medium">Warna tulisan</legend>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="o in [
                  { v: 'light', t: 'Terang (untuk latar gelap)' },
                  { v: 'dark', t: 'Gelap (untuk latar terang)' },
                ] as const"
                :key="o.v"
                :class="[
                  'flex h-10 cursor-pointer items-center gap-2 rounded-md px-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-ring',
                  design.ink === o.v ? 'border-2 border-primary bg-secondary' : 'border',
                ]"
              >
                <input v-model="design.ink" type="radio" name="ink" :value="o.v" class="sr-only" />
                {{ o.t }}
              </label>
            </div>
          </fieldset>

          <AdminTextField
            id="c-title"
            v-model="design.title"
            label="Judul di depan"
            :max="CARD_PRINT.limits.title"
          />
          <AdminTextField
            id="c-sub"
            v-model="design.subtitle"
            label="Keterangan di depan"
            :max="CARD_PRINT.limits.subtitle"
          />
          <AdminTextField
            id="c-back"
            v-model="design.backCaption"
            label="Tulisan di belakang"
            :max="CARD_PRINT.limits.backCaption"
          />
          <label class="flex min-h-11 items-center gap-2.5 text-sm">
            <input v-model="design.showLogo" type="checkbox" class="size-[18px] accent-primary" />
            Tampilkan logo (dari Pengaturan)
          </label>

          <div class="flex flex-wrap gap-2 border-t pt-4">
            <Button
              variant="outline"
              class="h-10"
              :disabled="!changedFromStandard"
              @click="resetToStandard"
            >
              <RotateCcw class="size-4" />
              Kembalikan desain standar
            </Button>
            <Button
              v-if="isSuper"
              class="h-10"
              :disabled="!changedFromStandard || saving"
              @click="saveStandard"
            >
              {{ saving ? 'Menyimpan…' : 'Simpan sebagai desain standar' }}
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            Kode QR tidak termasuk desain: ukuran, posisi, dan warnanya selalu tetap, dan selalu
            membuka alamat kartunya masing-masing.
            <template v-if="!isSuper">
              Perubahan hanya untuk cetakan ini; Super Admin yang menyimpan desain standar.
            </template>
          </p>
        </Card>

        <Card class="gap-3 p-5">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-base font-semibold">Kartu ({{ chosen.length }} dipilih)</h2>
            <label class="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                class="size-[18px] accent-primary"
                :checked="allChecked"
                @change="toggleAll"
              />
              Pilih semua
            </label>
          </div>
          <div
            class="flex max-h-72 flex-col overflow-y-auto rounded-md border"
            role="group"
            aria-label="Kartu yang dicetak"
          >
            <label
              v-for="c in cards ?? []"
              :key="c.code"
              class="flex min-h-11 items-center gap-3 border-b px-3 text-sm last:border-0"
            >
              <input
                v-model="selected"
                type="checkbox"
                :value="c.code"
                class="size-[18px] accent-primary"
              />
              <span class="grow">
                {{ c.label }}
                <span class="text-muted-foreground">· {{ c.group }}</span>
              </span>
              <span class="font-mono text-xs text-muted-foreground">{{ c.code }}</span>
            </label>
          </div>
        </Card>
      </div>

      <!-- Preview -->
      <aside
        aria-label="Pratinjau cetak"
        class="flex grow basis-[380px] flex-col gap-3 lg:sticky lg:top-20"
      >
        <b class="text-sm font-semibold">Pratinjau (ukuran sebenarnya ×1,5)</b>
        <template v-if="preview && settings">
          <template v-if="mode === 'kartu'">
            <div
              v-for="side in ['front', 'back'] as const"
              :key="side"
              class="flex flex-col gap-1.5"
            >
              <span class="text-xs text-muted-foreground">
                {{ side === 'front' ? 'Depan' : 'Belakang' }}
              </span>
              <div class="scaled rounded-[3mm] shadow-md">
                <CardPrintFace
                  :side="side"
                  :design="design"
                  :code="preview.code"
                  :url="preview.url"
                  :logo-url="settings.logoUrl"
                  :company="settings.company"
                />
              </div>
            </div>
          </template>
          <div v-else class="scaled-qr shadow-md">
            <CardQrSticker :code="preview.code" :label="preview.label" :url="preview.url" />
          </div>
        </template>
        <AdminEmptyState
          v-else
          title="Belum ada kartu"
          description="Daftarkan kartu dulu di menu Kartu NFC."
        />
        <div
          class="rounded-lg border bg-secondary px-4 py-3 text-[13px] leading-relaxed text-zinc-700"
        >
          <b>Saat mencetak</b>
          <ul class="mt-1 list-disc pl-5">
            <li>
              Skala
              <b>100% / Ukuran sebenarnya</b>
            </li>
            <li>Header &amp; footer browser dimatikan</li>
            <li>
              <b>Grafik latar</b>
              dinyalakan
            </li>
            <li v-if="mode === 'kartu' && layout === 'a4' && sides === 'both'">
              Cukup cetak satu sisi kertas: depan dan belakang tiap kartu ada di satu baris (depan
              kiri, belakang kanan). Potong sepasang lalu lipat di garis tengah, atau potong
              terpisah dan tempel saling membelakangi.
            </li>
            <li>Total {{ sheetCount }} halaman</li>
          </ul>
        </div>
      </aside>
    </div>

    <!-- What the printer gets. Hidden on screen; on paper everything else is hidden. -->
    <Teleport to="body">
      <div v-if="settings" id="card-print" aria-hidden="true">
        <template v-if="mode === 'qr'">
          <div v-for="(sheet, i) in sheets" :key="`q${i}`" class="sheet qr-sheet">
            <CardQrSticker
              v-for="c in sheet"
              :key="c.code"
              :code="c.code"
              :label="c.label"
              :url="c.url"
            />
          </div>
        </template>
        <template v-else-if="layout === 'pvc'">
          <template v-for="c in chosen" :key="c.code">
            <div v-if="sides !== 'back'" class="pvc-page">
              <CardPrintFace
                side="front"
                :design="design"
                :code="c.code"
                :url="c.url"
                :logo-url="settings.logoUrl"
                :company="settings.company"
              />
            </div>
            <div v-if="sides !== 'front'" class="pvc-page">
              <CardPrintFace
                side="back"
                :design="design"
                :code="c.code"
                :url="c.url"
                :logo-url="settings.logoUrl"
                :company="settings.company"
              />
            </div>
          </template>
        </template>
        <template v-else>
          <div v-for="(sheet, i) in faceSheets" :key="`s${i}`" class="sheet card-sheet">
            <div class="grid">
              <CardPrintFace
                v-for="f in sheet"
                :key="`${f.c.code}-${f.side}`"
                :side="f.side"
                :design="design"
                :code="f.c.code"
                :url="f.c.url"
                :logo-url="settings.logoUrl"
                :company="settings.company"
              />
            </div>
            <CardCutMarks />
          </div>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<style>
.scaled {
  width: calc(var(--card-w) * 1.5);
  height: calc(var(--card-h) * 1.5);
  overflow: hidden;
}
.scaled > .card-face {
  transform: scale(1.5);
  transform-origin: 0 0;
}
.scaled-qr {
  width: calc(60mm * 1.5);
  height: calc(70mm * 1.5);
  overflow: hidden;
  background: #fff;
}
.scaled-qr > * {
  transform: scale(1.5);
  transform-origin: 0 0;
}
#card-print {
  display: none;
}
@media print {
  body > *:not(#card-print) {
    display: none !important;
  }
  #card-print {
    display: block;
  }
  .sheet {
    position: relative;
    width: 210mm;
    height: 297mm;
    break-after: page;
    overflow: hidden;
  }
  .card-sheet .grid {
    position: absolute;
    left: calc((210mm - var(--card-cols) * var(--card-w)) / 2);
    top: calc((297mm - var(--card-rows) * var(--card-h)) / 2);
    display: grid;
    grid-template-columns: repeat(var(--card-cols), var(--card-w));
    grid-template-rows: repeat(var(--card-rows), var(--card-h));
  }
  .qr-sheet {
    display: grid;
    grid-template-columns: repeat(3, 60mm);
    grid-template-rows: repeat(4, 70mm);
    justify-content: center;
    align-content: center;
  }
  .pvc-page {
    width: var(--card-w);
    height: var(--card-h);
    overflow: hidden;
    break-after: page;
  }
}
</style>
