<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import type { Settings } from '#shared/types'

definePageMeta({ layout: 'admin', middleware: 'auth', title: 'Pengaturan', superOnly: true })
const { data, status } = useFetch<Settings>('/api/settings', { server: false })
// Only these fields are editable; the server rejects anything else (e.g. baseUrl).
const EDITABLE = [
  'company',
  'tagline',
  'logoUrl',
  'address',
  'wa',
  'phone',
  'email',
  'hours',
  'website',
  'brochure',
  'retentionAudit',
  'retentionTap',
] as const
type EditableSettings = Pick<Settings, (typeof EDITABLE)[number]>
const pickEditable = (s: Settings) => Object.fromEntries(EDITABLE.map(k => [k, s[k]])) as EditableSettings

const form = reactive<Partial<EditableSettings>>({})
watch(
  data,
  s => {
    if (s) Object.assign(form, pickEditable(s))
  },
  { immediate: true },
)
const { errors, submit } = useFieldErrors()
const saving = ref(false)

// Logo: PNG or WebP with a transparent background works best on the white poster header.
const logoInput = ref<HTMLInputElement>()
const logoError = ref('')
const logoUploading = ref(false)
async function uploadLogo(f: File | undefined) {
  logoError.value = f ? checkUpload(f, ['image/png', 'image/webp']) : ''
  if (!f || logoError.value) return
  logoUploading.value = true
  try {
    form.logoUrl = (await uploadFile(f, f.name)).url
  } catch (e) {
    logoError.value = (e as Error).message
  } finally {
    logoUploading.value = false
    if (logoInput.value) logoInput.value.value = ''
  }
}

async function save() {
  saving.value = true
  const res = await submit(() => $fetch<Settings>('/api/settings', { method: 'PUT', body: form }))
  saving.value = false
  if (res) {
    data.value = res
    toast.success('Pengaturan disimpan. Semua poster langsung memakai data baru.')
  }
}
function reset() {
  if (data.value) Object.assign(form, pickEditable(data.value))
}

const fields: { section: string; items: { key: keyof Settings; label: string; hint?: string; type?: string }[] }[] = [
  {
    section: 'Identitas perusahaan',
    items: [
      { key: 'company', label: 'Nama perusahaan' },
      { key: 'tagline', label: 'Tagline', hint: 'Contoh: Mitra Kesehatan Karyawan' },
      { key: 'address', label: 'Alamat' },
    ],
  },
  {
    section: 'Kontak resmi Marketing',
    items: [
      { key: 'wa', label: 'WhatsApp', hint: 'Format 62…, contoh: 628000000001' },
      { key: 'phone', label: 'Telepon', hint: 'Contoh: 0274 000 0000' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'hours', label: 'Jam layanan' },
    ],
  },
  {
    section: 'Tautan standar',
    items: [
      { key: 'website', label: 'Situs web resmi', type: 'url' },
      { key: 'brochure', label: 'Brosur default (PDF)', type: 'url', hint: 'Dipakai tombol “Unduh brosur”. Harus diawali https://' },
    ],
  },
]
</script>

<template>
  <div>
    <AdminPageHeader title="Pengaturan Situs" description="Dipakai di header, footer, dan tombol kontak semua poster." />
    <AdminTableSkeleton v-if="status === 'pending'" :rows="6" />
    <div v-else class="flex flex-wrap items-start gap-6">
      <form class="flex min-w-0 grow-[999] basis-[520px] flex-col gap-4" novalidate @submit.prevent="save">
        <Card class="gap-4">
          <CardHeader><CardTitle class="text-base">Logo</CardTitle></CardHeader>
          <CardContent class="flex flex-wrap items-center gap-4">
            <span class="flex h-20 min-w-48 items-center justify-center rounded-xl border bg-white px-4"
              ><img :src="form.logoUrl" alt="Logo saat ini" class="block h-11 w-auto"
            /></span>
            <div class="flex flex-col gap-1.5">
              <input
                ref="logoInput"
                type="file"
                class="sr-only"
                accept="image/png,image/webp"
                aria-label="Pilih file logo"
                @change="uploadLogo(($event.target as HTMLInputElement).files?.[0])"
              />
              <Button type="button" variant="outline" class="h-11 self-start" :disabled="logoUploading" @click="logoInput?.click()">{{
                logoUploading ? 'Mengunggah…' : 'Ganti logo'
              }}</Button>
              <span class="text-xs text-muted-foreground">PNG atau WebP berlatar transparan, maksimal 5 MB.</span>
              <AdminFieldError id="logo-err" :message="logoError || errors.logoUrl" />
            </div>
          </CardContent>
        </Card>
        <Card v-for="s in fields" :key="s.section" class="gap-4">
          <CardHeader
            ><CardTitle class="text-base">{{ s.section }}</CardTitle></CardHeader
          >
          <CardContent class="grid gap-4 sm:grid-cols-2">
            <AdminTextField
              v-for="f in s.items"
              :id="f.key"
              :key="f.key"
              v-model="(form as Record<string, string>)[f.key]"
              :type="f.type"
              :label="f.label"
              :hint="f.hint"
              :error="errors[f.key]"
            />
          </CardContent>
        </Card>
        <Card class="gap-4">
          <CardHeader><CardTitle class="text-base">Retensi log</CardTitle></CardHeader>
          <CardContent class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <Label for="ra">Simpan audit log selama</Label>
              <AdminNativeSelect id="ra" v-model.number="form.retentionAudit"
                ><option :value="90">90 hari</option>
                <option :value="180">180 hari</option>
                <option :value="365">1 tahun</option>
                <option :value="730">2 tahun</option></AdminNativeSelect
              >
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="rt">Simpan data tap selama</Label>
              <AdminNativeSelect id="rt" v-model.number="form.retentionTap"
                ><option :value="365">1 tahun</option>
                <option :value="730">2 tahun</option></AdminNativeSelect
              >
            </div>
            <p class="text-xs text-muted-foreground sm:col-span-2">Data yang lebih lama dihapus otomatis setiap malam.</p>
          </CardContent>
        </Card>
        <div class="flex justify-end gap-2">
          <Button type="button" variant="outline" class="h-11" @click="reset">Batalkan perubahan</Button>
          <Button type="submit" class="h-11" :disabled="saving">{{ saving ? 'Menyimpan…' : 'Simpan pengaturan' }}</Button>
        </div>
      </form>

      <aside class="flex grow basis-72 flex-col gap-2">
        <b class="text-sm font-semibold">Pratinjau header &amp; footer poster</b>
        <div class="overflow-hidden rounded-2xl border bg-brand-bg text-slate-900">
          <div class="flex items-center border-b-[3px] border-brand-cyan bg-white p-3">
            <img :src="form.logoUrl" :alt="form.company" class="block h-9 w-auto" />
          </div>
          <div class="m-4 flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-400 text-xs text-slate-600">
            poster
          </div>
          <div class="border-t bg-white p-4 text-xs leading-relaxed text-slate-600">
            <b class="text-slate-900">{{ form.company }}</b> · {{ form.address }}<br />{{ form.phone }} · {{ form.email }}<br />{{
              form.hours
            }}
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
