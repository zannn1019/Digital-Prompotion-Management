<script setup lang="ts">
// Poster form in two steps: (1) image and everything shown on the visitor page,
// (2) schedule and pages. Numbered sections follow the order on the visitor page.
// Larger text and controls: the main user is a non-technical content maker.
import { toast } from 'vue-sonner'
import { ArrowLeft, ArrowRight, Check, PenLine } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { designText } from '#shared/design'
import type { PosterDesign } from '#shared/design'
import type { ContactButton, Page, Poster, PosterCategory, PublishStatus } from '#shared/types'
import { POSTER_CATEGORY, POSTER_LIMITS } from '#shared/constants'
import { TODAY, addDays } from '#shared/utils/format'
import type { UploadedFile } from '~/utils/upload'

const props = defineProps<{ poster?: Poster & { pageIds?: string[] } }>()
const canvasEditor = useRuntimeConfig().public.canvasEditor

const { data: pages } = useFetch<(Page & { cardCount: number })[]>('/api/pages', { server: false })
const choosablePages = computed(() => (pages.value ?? []).filter(p => !p.isDefault))
const { errors, submit } = useFieldErrors()

const p = props.poster
const form = reactive({
  file: (p?.imageUrl
    ? { url: p.imageUrl, previewUrl: p.imageUrl, name: p.imageFile ?? 'poster', size: p.imageSize ?? 0 }
    : null) as UploadedFile | null,
  title: p?.title ?? '',
  category: (p?.category ?? '') as PosterCategory | '',
  description: p?.description ?? '',
  price: p?.price ?? '',
  priceUnit: p?.priceUnit ?? '',
  listTitle: p?.listTitle ?? '',
  points: [...(p?.points ?? [])],
  showBrochure: !!p?.buttons?.includes('doc'),
  brochure: (p?.brochureUrl ? { url: p.brochureUrl, name: p.brochureFile ?? 'brosur.pdf', size: 0 } : null) as UploadedFile | null,
  terms: p?.terms ?? '',
  contacts: (p?.buttons ?? ['wa', 'tel']).filter(b => b !== 'doc') as ContactButton[],
  /** Internal name for the team's list; defaults to the title. */
  name: p?.name ?? '',
  start: p?.start ?? TODAY,
  end: p?.end ?? addDays(TODAY, 29),
  pageIds: [...(p?.pageIds ?? [])],
  /** Set when the image comes from the canvas editor (hidden in V1). */
  design: (p?.design ?? null) as PosterDesign | null,
})
const { dirty, markSaved } = useDirtyGuard(() => form)
const step = ref<1 | 2>(1)

// Coming back from the canvas editor: restore the stashed fields and take the new image.
const draft = useDesignDraft()
if (draft.value?.file && draft.value.posterId === props.poster?.id) {
  const { form: fields, design, file } = draft.value
  if (fields) Object.assign(form, fields)
  form.design = design ?? null
  if (design) {
    const words = designText(design)
    if (!form.title) form.title = words.split('\n')[0]!.slice(0, POSTER_LIMITS.title)
    if (!form.description) form.description = words.replace(/\n+/g, ' · ').slice(0, POSTER_LIMITS.description)
  }
  form.file = file
  draft.value = null
}

/** Opens the editor, keeping this form's fields so nothing typed is lost. */
async function openEditor() {
  const { file: _file, design, ...fields } = form
  // JSON copy: plain data only, detached from this form's reactive state.
  draft.value = JSON.parse(JSON.stringify({ posterId: props.poster?.id, design: design ?? undefined, form: fields }))
  markSaved()
  await navigateTo('/admin/posters/design')
}

function useUploadInstead() {
  form.design = null
  form.file = null
}

const STEP1_FIELDS = [
  'imageUrl',
  'title',
  'category',
  'description',
  'price',
  'priceUnit',
  'listTitle',
  'points',
  'terms',
  'brochureUrl',
  'buttons',
  'name',
]

/** Required step-1 fields, checked before moving on so errors show where they are. */
function checkStep1() {
  const e: Record<string, string> = {}
  if (!form.file) e.imageUrl = 'Unggah file poster terlebih dahulu.'
  if (!form.title.trim()) e.title = 'Isian ini wajib diisi.'
  if (!form.description.trim()) e.description = 'Isian ini wajib. Tulis 1–2 kalimat penjelasan.'
  errors.value = e
  if (Object.keys(e).length) toast.error(`Ada ${Object.keys(e).length} isian yang perlu diperbaiki. Lihat tanda merah.`)
  return !Object.keys(e).length
}
function next() {
  if (!checkStep1()) return
  step.value = 2
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const saving = ref<PublishStatus | null>(null)
async function save(status: PublishStatus) {
  saving.value = status
  const body = {
    kind: 'gambar' as const,
    status,
    name: form.name.trim() || form.title.trim(),
    title: form.title,
    category: form.category || undefined,
    description: form.description,
    price: form.price,
    priceUnit: form.priceUnit,
    listTitle: form.listTitle,
    points: form.points.map(x => x.trim()).filter(Boolean),
    terms: form.terms,
    brochureUrl: form.showBrochure ? (form.brochure?.url ?? null) : null,
    brochureFile: form.showBrochure ? form.brochure?.name : undefined,
    buttons: [...form.contacts, ...(form.showBrochure ? ['doc' as const] : [])],
    start: form.start,
    end: form.end,
    pageIds: form.pageIds,
    imageUrl: form.file?.previewUrl ?? form.file?.url ?? '',
    imageFile: form.file?.name,
    imageSize: form.file?.size,
    design: form.design,
  }
  const res = await submit(() =>
    props.poster
      ? $fetch<Poster>(`/api/posters/${props.poster.id}`, { method: 'PUT', body })
      : $fetch<Poster>('/api/posters', { method: 'POST', body }),
  )
  saving.value = null
  if (!res) {
    // Send the user back to whichever step holds the problem.
    if (Object.keys(errors.value).some(k => STEP1_FIELDS.includes(k))) step.value = 1
    return
  }
  markSaved()
  toast.success(status === 'published' ? 'Poster diterbitkan. Akan tampil sesuai jadwal.' : 'Draft tersimpan.')
  await navigateTo('/admin/posters')
}

const preview = usePosterPreview(() => ({
  posters: [
    draftPoster({
      imageUrl: form.file?.previewUrl ?? form.file?.url ?? '/dummy/foto-contoh.svg',
      title: form.title || 'Judul poster',
      category: form.category || undefined,
      description: form.description || 'Penjelasan singkat akan tampil di sini.',
      price: form.price,
      priceUnit: form.priceUnit,
      listTitle: form.listTitle,
      points: form.points,
      terms: form.terms,
      buttons: [...form.contacts, ...(form.showBrochure ? ['doc' as const] : [])],
      end: form.end,
    }),
  ],
}))
</script>

<template>
  <div class="flex flex-wrap items-start gap-8">
    <form class="flex min-w-0 grow-[999] basis-[520px] flex-col gap-6 text-base" novalidate @submit.prevent>
      <ol aria-label="Langkah" class="flex flex-wrap gap-2 text-base">
        <li
          :class="[
            'flex items-center gap-2 rounded-full px-4 py-2 font-semibold',
            step === 1 ? 'bg-primary text-primary-foreground' : 'bg-green-100 text-green-900',
          ]"
          :aria-current="step === 1 ? 'step' : undefined"
        >
          <Check v-if="step === 2" class="size-4" aria-hidden="true" /><span v-else>1</span>Gambar &amp; isi poster
        </li>
        <li
          :class="[
            'flex items-center gap-2 rounded-full px-4 py-2 font-semibold',
            step === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          ]"
          :aria-current="step === 2 ? 'step' : undefined"
        >
          <span>2</span>Atur jadwal &amp; halaman
        </li>
      </ol>

      <template v-if="step === 1">
        <p class="text-[15px] leading-relaxed text-muted-foreground">
          Isi bagian bernomor sesuai urutan di halaman pengunjung. Bagian <b>opsional</b> boleh dikosongkan dan tidak akan tampil.
        </p>

        <AdminFormSection id="s1" :n="1" title="Gambar poster">
          <template v-if="form.design && form.file">
            <div class="flex flex-wrap items-center gap-4 rounded-xl border p-3">
              <img :src="form.file.url" alt="" class="h-28 w-[90px] rounded object-cover" />
              <div class="min-w-0 grow">
                <b class="block text-[17px] font-semibold">Didesain di editor</b>
                <span class="text-[15px] text-muted-foreground">1080 × 1350 · bisa diubah lagi kapan saja</span>
              </div>
              <div class="flex flex-wrap gap-2">
                <Button v-if="canvasEditor" type="button" class="h-12 text-base" @click="openEditor"
                  ><PenLine class="size-4" />Ubah desain</Button
                >
                <Button type="button" variant="outline" class="h-12 text-base" @click="useUploadInstead">Pakai file unggahan</Button>
              </div>
            </div>
          </template>
          <template v-else>
            <p class="text-[15px] leading-relaxed text-zinc-700">
              Poster yang sudah jadi, dari aplikasi desain apa pun: <b>PNG</b>, <b>JPG</b>, <b>WebP</b>, atau <b>PDF</b>, maksimal
              <b>5 MB</b>. Paling bagus tegak 4:5 (misal 1080 × 1350).
            </p>
            <AdminFileDropzone v-model="form.file" :error="errors.imageUrl" />
            <p v-if="canvasEditor" class="text-[15px] text-zinc-700">
              Belum punya poster?
              <button type="button" class="font-semibold underline underline-offset-4" @click="openEditor">Desain sendiri di editor</button>
            </p>
          </template>
        </AdminFormSection>

        <AdminFormSection id="s2" :n="2" title="Judul & penjelasan">
          <div class="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <AdminTextField
              id="title"
              v-model="form.title"
              large
              required
              label="Judul poster"
              :max="POSTER_LIMITS.title"
              :error="errors.title"
              placeholder="Contoh: Sleep Lab"
            />
            <div class="flex flex-col gap-1.5">
              <label for="category" class="text-[17px] font-semibold">Kategori</label>
              <AdminNativeSelect id="category" v-model="form.category" class="h-13 text-[17px]">
                <option value="">Tanpa kategori</option>
                <option v-for="(label, key) in POSTER_CATEGORY" :key="key" :value="key">{{ label }}</option>
              </AdminNativeSelect>
            </div>
          </div>
          <AdminTextField
            id="desc"
            v-model="form.description"
            large
            required
            multiline
            :rows="3"
            label="Penjelasan singkat"
            :max="POSTER_LIMITS.description"
            :error="errors.description"
            hint="1–2 kalimat. Ikut dibacakan HP untuk tunanetra dan tetap tampil saat gambar gagal dimuat."
          />
          <AdminTextField
            id="name"
            v-model="form.name"
            label="Nama di daftar konten"
            :max="80"
            :error="errors.name"
            hint="Hanya untuk tim. Kosongkan untuk memakai judul."
          />
        </AdminFormSection>

        <AdminFormSection id="s3" :n="3" title="Harga" optional>
          <div class="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <AdminTextField
              id="price"
              v-model="form.price"
              large
              label="Harga"
              :max="POSTER_LIMITS.price"
              :error="errors.price"
              placeholder="Contoh: Rp 3.100.000"
            />
            <AdminTextField
              id="unit"
              v-model="form.priceUnit"
              large
              label="Per"
              :max="POSTER_LIMITS.priceUnit"
              :error="errors.priceUnit"
              placeholder="Contoh: pemeriksaan"
            />
          </div>
          <span class="-mt-1 text-[15px] text-muted-foreground">Kosongkan bila tidak ada harga, misalnya acara atau info layanan.</span>
        </AdminFormSection>

        <AdminFormSection id="s4" :n="4" title="Daftar poin" optional>
          <AdminTextField
            id="listTitle"
            v-model="form.listTitle"
            large
            label="Judul daftar"
            :max="POSTER_LIMITS.listTitle"
            :error="errors.listTitle"
            placeholder="Contoh: Manfaat, Fasilitas, Yang didapat"
            class="sm:max-w-sm"
          />
          <AdminPointsField v-model="form.points" :error="errors.points" />
        </AdminFormSection>

        <AdminFormSection id="s5" :n="5" title="Brosur & syarat" optional>
          <AdminBrochureField v-model:show="form.showBrochure" v-model:file="form.brochure" :error="errors.brochureUrl" />
          <AdminTextField
            id="terms"
            v-model="form.terms"
            large
            multiline
            :rows="3"
            label="Syarat & ketentuan"
            :max="POSTER_LIMITS.terms"
            :error="errors.terms"
            hint="Tampil terlipat; pengunjung membukanya bila perlu."
          />
        </AdminFormSection>

        <AdminFormSection id="s6" :n="6" title="Tombol kontak">
          <AdminContactButtonPicker v-model="form.contacts" />
        </AdminFormSection>
      </template>

      <AdminScheduleStep
        v-else
        v-model:start="form.start"
        v-model:end="form.end"
        v-model:page-ids="form.pageIds"
        :pages="choosablePages"
        :errors="errors"
      />

      <div class="sticky bottom-2 z-10 grid grid-cols-2 items-center gap-2 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:bottom-3 sm:flex sm:gap-3 sm:p-4">
        <Button
          v-if="step === 2"
          type="button"
          variant="ghost"
          class="order-2 col-span-2 h-12 justify-start px-2 text-sm sm:order-none sm:h-13 sm:px-3 sm:text-base"
          @click="step = 1"
        >
          ><ArrowLeft class="size-4" />Kembali ke isi poster</Button
        >
        <span class="order-1 col-span-2 px-1 text-center text-xs leading-snug text-muted-foreground sm:order-none sm:grow sm:px-0 sm:text-left sm:text-[15px]">{{
          dirty ? 'Ada perubahan yang belum disimpan.' : 'Semua perubahan tersimpan.'
        }}</span>
        <Button
          type="button"
          variant="outline"
          class="order-3 h-12 min-w-0 px-2 text-sm sm:order-none sm:h-13 sm:px-5 sm:text-base"
          :disabled="!!saving"
          @click="save('draft')"
        >{{
          saving === 'draft' ? 'Menyimpan…' : 'Simpan Draft'
        }}</Button>
        <Button
          v-if="step === 1"
          type="button"
          class="order-4 h-12 min-w-0 px-2 text-sm sm:order-none sm:h-13 sm:px-5 sm:text-base"
          @click="next"
          >Lanjut: atur jadwal<ArrowRight class="size-4"
        /></Button>
        <Button
          v-else
          type="button"
          class="order-4 h-12 min-w-0 px-2 text-sm sm:order-none sm:h-13 sm:px-5 sm:text-base"
          :disabled="!!saving"
          @click="save('published')"
        >{{
          saving === 'published' ? 'Menerbitkan…' : 'Terbitkan poster'
        }}</Button>
      </div>
    </form>

    <aside aria-label="Pratinjau HP" class="flex grow basis-[340px] flex-col items-center gap-3 lg:sticky lg:top-20">
      <b class="self-stretch text-[17px] font-semibold">Begini tampilannya di HP</b>
      <AdminPhoneFrame>
        <PosterView v-if="preview" :view="preview" preview class="min-h-full" />
      </AdminPhoneFrame>
      <span class="text-center text-sm text-muted-foreground">Ketik di formulir, pratinjau ikut berubah.</span>
    </aside>
  </div>
</template>
