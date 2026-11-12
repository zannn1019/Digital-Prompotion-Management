<script setup lang="ts">
// Left side of the editor: tool tabs and what each one adds to the poster.
import { ImagePlus, Layers, Lock, Palette, Shapes, Type } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { BACKGROUNDS, DESIGN_SIZE, elementName, isLocked } from '#shared/design'
import type { DesignElement, PosterDesign } from '#shared/design'

const props = defineProps<{ design: PosterDesign; selectedId: string | null }>()
const emit = defineEmits<{
  add: [el: DesignElement]
  background: [bg: { top: string; bottom: string }]
  select: [id: string]
}>()

type Tab = 'teks' | 'foto' | 'bentuk' | 'latar' | 'urutan'
const TABS: { id: Tab; label: string; icon: typeof Type }[] = [
  { id: 'teks', label: 'Teks', icon: Type },
  { id: 'foto', label: 'Foto', icon: ImagePlus },
  { id: 'bentuk', label: 'Bentuk', icon: Shapes },
  { id: 'latar', label: 'Latar', icon: Palette },
  { id: 'urutan', label: 'Urutan', icon: Layers },
]
const tab = ref<Tab>('teks')

const { width: W } = DESIGN_SIZE
const TEXTS = [
  {
    label: 'Tambah judul',
    cls: 'text-2xl font-extrabold font-poster',
    make: () => makeText({ text: 'Judul poster', fontSize: 110, bold: true }),
  },
  { label: 'Tambah subjudul', cls: 'text-lg font-semibold', make: () => makeText({ text: 'Subjudul', fontSize: 56, bold: true, y: 360 }) },
  { label: 'Tambah teks isi', cls: 'text-base', make: () => makeText({ text: 'Tulis keterangan di sini', fontSize: 42, y: 520 }) },
  {
    label: '• Tambah daftar poin',
    cls: 'text-base',
    make: () =>
      makeText({ text: '• Poin pertama\n• Poin kedua\n• Poin ketiga', fontSize: 42, y: 520, x: 120, width: W - 240, align: 'left' }),
  },
]
const SHAPES = [
  { label: 'Kotak', make: () => makeRect({ fill: '#1673c4', cornerRadius: 0 }) },
  { label: 'Kotak isi', make: () => makeRect({ fill: '#ffffff', cornerRadius: 28 }) },
  { label: 'Lingkaran', make: () => makeRect({ width: 300, height: 300, fill: '#facc15', cornerRadius: 150 }) },
  { label: 'Label harga', make: () => makeLabel({ text: 'Rp 000.000' }) },
]

// Photos: uploaded through the normal upload route, then placed at their own aspect ratio.
const input = ref<HTMLInputElement>()
const uploading = ref(false)
const error = ref('')
const recent = ref<string[]>([])
const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp']

async function onFile(f: File | undefined) {
  error.value = ''
  if (!f) return
  error.value = checkUpload(f, PHOTO_TYPES)
  if (error.value) return
  uploading.value = true
  try {
    const up = await uploadFile(f, f.name)
    recent.value = [up.url, ...recent.value.filter(u => u !== up.url)].slice(0, 8)
    await addPhoto(up.url)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    uploading.value = false
    if (input.value) input.value.value = ''
  }
}

/** Height ÷ width of an image; 1 when it cannot be read. (onload, not decode(): decode can stall in background tabs.) */
function aspectRatio(src: string): Promise<number> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1)
    img.onerror = () => resolve(1)
    img.src = src
  })
}

async function addPhoto(src: string) {
  const ratio = await aspectRatio(src)
  const width = 600
  emit('add', makePhoto({ src, width, height: Math.round(width * ratio), x: (W - width) / 2, y: 300 }))
}

const layers = computed(() => [...props.design.elements].reverse())
</script>

<template>
  <div class="flex min-h-0 border-r">
    <nav aria-label="Alat" class="flex w-[84px] shrink-0 flex-col gap-1 border-r p-2">
      <button
        v-for="t in TABS"
        :key="t.id"
        type="button"
        :aria-pressed="tab === t.id"
        :class="[
          'flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg text-sm font-medium',
          tab === t.id ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-muted',
        ]"
        @click="tab = t.id"
      >
        <component :is="t.icon" class="size-5" aria-hidden="true" />{{ t.label }}
      </button>
    </nav>

    <div class="flex w-[240px] shrink-0 flex-col gap-3 overflow-y-auto bg-zinc-50 p-4">
      <template v-if="tab === 'teks'">
        <h2 class="text-lg font-bold">Teks</h2>
        <button
          v-for="t in TEXTS"
          :key="t.label"
          type="button"
          :class="['min-h-13 rounded-lg border bg-white px-3 py-2 text-left hover:border-zinc-900', t.cls]"
          @click="emit('add', t.make())"
        >
          {{ t.label }}
        </button>
        <p class="text-sm leading-relaxed text-muted-foreground">Ubah isi teks di panel kanan setelah teks dipilih.</p>
      </template>

      <template v-else-if="tab === 'foto'">
        <h2 class="text-lg font-bold">Foto</h2>
        <input
          ref="input"
          type="file"
          class="sr-only"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Pilih foto"
          @change="onFile(($event.target as HTMLInputElement).files?.[0])"
        />
        <Button type="button" class="h-12 text-base" :disabled="uploading" @click="input?.click()">{{
          uploading ? 'Mengunggah…' : 'Unggah foto dari laptop'
        }}</Button>
        <p class="text-sm text-muted-foreground">PNG, JPG, atau WebP · maksimal 5 MB</p>
        <p v-if="error" class="text-sm font-semibold text-destructive" role="alert">{{ error }}</p>
        <div v-if="recent.length" class="grid grid-cols-2 gap-2">
          <button
            v-for="src in recent"
            :key="src"
            type="button"
            class="aspect-square overflow-hidden rounded-lg border hover:border-zinc-900"
            aria-label="Taruh foto ini di poster"
            @click="addPhoto(src)"
          >
            <img :src="src" alt="" class="size-full object-cover" />
          </button>
        </div>
        <p class="text-sm leading-relaxed text-muted-foreground">
          Untuk mengganti foto contoh, pilih fotonya di poster lalu tekan “Ganti foto”.
        </p>
      </template>

      <template v-else-if="tab === 'bentuk'">
        <h2 class="text-lg font-bold">Bentuk &amp; label</h2>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="s in SHAPES"
            :key="s.label"
            type="button"
            class="min-h-16 rounded-lg border bg-white px-2 text-sm font-medium hover:border-zinc-900"
            @click="emit('add', s.make())"
          >
            {{ s.label }}
          </button>
        </div>
      </template>

      <template v-else-if="tab === 'latar'">
        <h2 class="text-lg font-bold">Warna latar</h2>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="b in BACKGROUNDS"
            :key="b.name"
            type="button"
            :aria-pressed="design.background.top === b.top && design.background.bottom === b.bottom"
            :class="[
              'flex h-16 items-end rounded-lg border p-2 text-sm font-semibold',
              design.background.top === b.top && design.background.bottom === b.bottom ? 'ring-2 ring-zinc-900 ring-offset-2' : '',
            ]"
            :style="{ background: `linear-gradient(170deg, ${b.top}, ${b.bottom})`, color: b.name === 'Terang' ? '#0b3a6e' : '#ffffff' }"
            @click="emit('background', { top: b.top, bottom: b.bottom })"
          >
            {{ b.name }}
          </button>
        </div>
        <div class="mt-2 flex gap-2 rounded-lg border bg-white p-3 text-sm leading-relaxed text-zinc-700">
          <Lock class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Logo dan kotak <b>Informasi</b> diambil dari Pengaturan Situs dan dikunci supaya semua poster seragam.</span>
        </div>
      </template>

      <template v-else>
        <h2 class="text-lg font-bold">Urutan</h2>
        <p class="text-sm text-muted-foreground">Paling atas tampil paling depan.</p>
        <button
          v-for="el in layers"
          :key="el.id"
          type="button"
          :aria-pressed="el.id === selectedId"
          :class="[
            'flex min-h-11 items-center gap-2 rounded-lg border bg-white px-3 text-left text-sm',
            el.id === selectedId ? 'border-zinc-900 font-semibold' : '',
          ]"
          @click="emit('select', el.id)"
        >
          <span class="min-w-0 grow truncate">{{ elementName(el) }}</span>
          <Lock v-if="isLocked(el)" class="size-4 shrink-0 text-muted-foreground" aria-label="terkunci" />
        </button>
      </template>
    </div>
  </div>
</template>
