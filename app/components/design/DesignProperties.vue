<script setup lang="ts">
// Right side of the editor: settings for the selected element. Live edits use
// `update(patch, false)`; the change is committed to undo history on blur/click.
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Copy, Lock, Minus, Plus, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ELEMENT_LABEL, MAX_FONT, MIN_FONT, isLocked } from '#shared/design'
import type { DesignElement } from '#shared/design'

const props = defineProps<{ element: DesignElement | null; canOpenSettings: boolean }>()
const emit = defineEmits<{
  update: [patch: Partial<DesignElement>, commit: boolean]
  commit: []
  action: [a: 'forward' | 'backward' | 'duplicate' | 'delete']
}>()

const set = (patch: Partial<DesignElement>, commit = true) => emit('update', patch, commit)

const FONT_STEP = 6
function resize(step: number) {
  const el = props.element
  if (!el || !('fontSize' in el)) return
  set({ fontSize: Math.min(MAX_FONT, Math.max(MIN_FONT, el.fontSize + step)) })
}

// Two-way colour fields for the swatch pickers; each pick commits.
const color = (key: 'fill' | 'background') =>
  computed({
    get: () => (props.element && key in props.element ? ((props.element as Record<string, any>)[key] as string) : ''),
    set: v => set({ [key]: v } as Partial<DesignElement>),
  })
const fill = color('fill')
const background = color('background')

const CORNERS = [
  { label: 'Tajam', value: 0 },
  { label: 'Membulat', value: 28 },
  { label: 'Bulat penuh', value: -1 },
] as const
function setCorner(v: number) {
  const el = props.element
  if (!el || !('cornerRadius' in el)) return
  set({ cornerRadius: v < 0 ? Math.min(el.width, el.height) / 2 : v })
}

const ALIGNS = [
  { value: 'left', label: 'Rata kiri', icon: AlignLeft },
  { value: 'center', label: 'Rata tengah', icon: AlignCenter },
  { value: 'right', label: 'Rata kanan', icon: AlignRight },
] as const

const photoInput = ref<HTMLInputElement>()
const uploading = ref(false)
const photoError = ref('')
async function replacePhoto(f: File | undefined) {
  photoError.value = ''
  if (!f) return
  photoError.value = checkUpload(f, ['image/png', 'image/jpeg', 'image/webp'])
  if (photoError.value) return
  uploading.value = true
  try {
    set({ src: (await uploadFile(f, f.name)).url })
  } catch (e) {
    photoError.value = (e as Error).message
  } finally {
    uploading.value = false
    if (photoInput.value) photoInput.value.value = ''
  }
}
</script>

<template>
  <aside aria-label="Pengaturan elemen" class="flex w-[280px] shrink-0 flex-col gap-5 overflow-y-auto border-l p-4">
    <template v-if="!element">
      <h2 class="text-lg font-bold">Pilih elemen</h2>
      <p class="text-[15px] leading-relaxed text-zinc-700">
        Klik teks, foto, atau bentuk di poster untuk mengubahnya. Seret untuk memindah, tarik sudut kotak oranye untuk mengubah ukuran.
      </p>
      <p class="text-[15px] leading-relaxed text-zinc-700">Warna latar ada di tab <b>Latar</b>.</p>
    </template>

    <template v-else>
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-lg font-bold">{{ ELEMENT_LABEL[element.type] }}</h2>
        <span v-if="isLocked(element)" class="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-sm"
          ><Lock class="size-3.5" aria-hidden="true" />Terkunci</span
        >
      </div>

      <!-- Text and label: content, size, colours -->
      <template v-if="element.type === 'text' || element.type === 'label'">
        <div class="flex flex-col gap-2">
          <Label for="el-text" class="text-[15px] font-semibold">Isi teks</Label>
          <textarea
            v-if="element.type === 'text'"
            id="el-text"
            :value="element.text"
            rows="4"
            maxlength="300"
            class="rounded-lg border border-zinc-300 px-3 py-2 text-base leading-snug"
            @input="set({ text: ($event.target as HTMLTextAreaElement).value }, false)"
            @change="emit('commit')"
          />
          <input
            v-else
            id="el-text"
            :value="element.text"
            maxlength="80"
            class="h-12 rounded-lg border border-zinc-300 px-3 text-base"
            @input="set({ text: ($event.target as HTMLInputElement).value }, false)"
            @change="emit('commit')"
          />
        </div>
        <div class="flex flex-col gap-2">
          <span class="text-[15px] font-semibold">Ukuran huruf</span>
          <div class="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              class="h-12 w-14"
              aria-label="Perkecil huruf"
              :disabled="element.fontSize <= MIN_FONT"
              @click="resize(-FONT_STEP)"
              ><Minus class="size-5"
            /></Button>
            <span class="grow text-center text-base font-semibold">{{ element.fontSize }} px</span>
            <Button
              type="button"
              variant="outline"
              class="h-12 w-14"
              aria-label="Perbesar huruf"
              :disabled="element.fontSize >= MAX_FONT"
              @click="resize(FONT_STEP)"
              ><Plus class="size-5"
            /></Button>
          </div>
        </div>
        <template v-if="element.type === 'text'">
          <label class="flex min-h-11 items-center gap-3 text-[15px]">
            <input
              type="checkbox"
              class="size-5 accent-zinc-900"
              :checked="element.bold"
              @change="set({ bold: ($event.target as HTMLInputElement).checked })"
            />Tebal
          </label>
          <fieldset class="flex flex-col gap-2">
            <legend class="mb-2 text-[15px] font-semibold">Perataan</legend>
            <div class="flex gap-1.5">
              <Button
                v-for="a in ALIGNS"
                :key="a.value"
                type="button"
                :variant="element.align === a.value ? 'default' : 'outline'"
                class="h-11 flex-1"
                :aria-label="a.label"
                :aria-pressed="element.align === a.value"
                @click="set({ align: a.value })"
              >
                <component :is="a.icon" class="size-5" />
              </Button>
            </div>
          </fieldset>
        </template>
        <DesignSwatches v-model="fill" label="Warna teks" />
        <DesignSwatches v-if="element.type === 'label'" v-model="background" label="Warna label" />
      </template>

      <template v-else-if="element.type === 'rect'">
        <DesignSwatches v-model="fill" label="Warna" />
        <fieldset class="flex flex-col gap-2">
          <legend class="mb-2 text-[15px] font-semibold">Sudut</legend>
          <div class="flex flex-wrap gap-1.5">
            <Button v-for="c in CORNERS" :key="c.label" type="button" variant="outline" class="h-11 grow" @click="setCorner(c.value)">{{
              c.label
            }}</Button>
          </div>
        </fieldset>
      </template>

      <template v-else-if="element.type === 'image'">
        <input
          ref="photoInput"
          type="file"
          class="sr-only"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Pilih foto pengganti"
          @change="replacePhoto(($event.target as HTMLInputElement).files?.[0])"
        />
        <Button type="button" class="h-12 text-base" :disabled="uploading" @click="photoInput?.click()">{{
          uploading ? 'Mengunggah…' : 'Ganti foto'
        }}</Button>
        <p v-if="photoError" class="text-sm font-semibold text-destructive" role="alert">{{ photoError }}</p>
        <label class="flex min-h-11 items-center gap-3 text-[15px]">
          <input
            type="checkbox"
            class="size-5 accent-zinc-900"
            :checked="element.cornerRadius > 0"
            @change="set({ cornerRadius: ($event.target as HTMLInputElement).checked ? 28 : 0 })"
          />Sudut membulat
        </label>
        <p class="text-sm leading-relaxed text-muted-foreground">Foto dipotong otomatis mengikuti bentuk kotaknya.</p>
      </template>

      <template v-else>
        <p class="text-[15px] leading-relaxed text-zinc-700">
          Elemen ini mengikuti Pengaturan Situs supaya semua poster seragam. Tidak bisa dipindah, diubah, atau dihapus di sini.
        </p>
        <NuxtLink v-if="canOpenSettings" to="/admin/settings" class="text-[15px] font-medium underline underline-offset-4"
          >Buka Pengaturan Situs</NuxtLink
        >
        <p v-else class="text-[15px] text-muted-foreground">Hubungi Super Admin bila datanya perlu diubah.</p>
      </template>

      <div v-if="!isLocked(element)" class="mt-auto flex flex-col gap-2 border-t pt-4">
        <span class="text-[15px] font-semibold">Elemen</span>
        <div class="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" class="h-11" @click="emit('action', 'forward')"
            ><ArrowUp class="size-4" />Ke depan</Button
          >
          <Button type="button" variant="outline" class="h-11" @click="emit('action', 'backward')"
            ><ArrowDown class="size-4" />Ke belakang</Button
          >
          <Button type="button" variant="outline" class="h-11" @click="emit('action', 'duplicate')"><Copy class="size-4" />Duplikat</Button>
          <Button type="button" variant="outline" class="h-11 border-red-300 text-red-700 hover:bg-red-50" @click="emit('action', 'delete')"
            ><Trash2 class="size-4" />Hapus</Button
          >
        </div>
      </div>
    </template>
  </aside>
</template>
