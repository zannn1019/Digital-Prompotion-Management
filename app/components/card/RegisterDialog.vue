<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Card, Page } from '#shared/types'

const open = defineModel<boolean>('open', { required: true })
defineProps<{ pages: Page[]; groups: string[] }>()
const emit = defineEmits<{ registered: [] }>()

const blank = () => ({
  count: 1,
  label: '',
  group: '',
  pageId: '',
  ownerId: null as string | null,
})
const form = reactive(blank())
const { errors, submit } = useFieldErrors()
// Blocks a second tap while the first request runs (it would register the cards twice).
const saving = ref(false)

async function register() {
  if (saving.value) return
  saving.value = true
  const res = await submit(() =>
    $fetch<Card[]>('/api/cards', {
      method: 'POST',
      body: { ...form, count: Number(form.count), pageId: form.pageId || null },
    }),
  )
  saving.value = false
  if (!res) return
  toast.success(
    `${res.length} kartu terdaftar. Tulis alamatnya ke kartu fisik lewat “Tulis ke kartu”.`,
  )
  Object.assign(form, blank())
  open.value = false
  emit('registered')
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Daftarkan kartu baru</DialogTitle>
        <DialogDescription>
          Kode acak dibuat otomatis untuk setiap kartu. Setelah itu, tulis alamatnya ke kartu fisik.
        </DialogDescription>
      </DialogHeader>
      <form id="register-cards" novalidate class="flex flex-col gap-4" @submit.prevent="register">
        <AdminTextField
          id="r-count"
          v-model="form.count"
          type="number"
          label="Jumlah kartu (1–50)"
          :error="errors.count"
        />
        <AdminTextField
          id="r-label"
          v-model="form.label"
          label="Lokasi / label"
          placeholder="Contoh: Pos satpam gerbang utama"
          :error="errors.label"
          hint="Nomor urut ditambahkan otomatis bila lebih dari 1 kartu."
        />
        <div class="flex flex-col gap-1.5">
          <AdminTextField
            id="r-group"
            v-model="form.group"
            label="Kelompok"
            list="r-groups"
            placeholder="Contoh: PT Contoh Tekstil · Produksi"
            :error="errors.group"
          />
          <datalist id="r-groups"><option v-for="g in groups" :key="g" :value="g" /></datalist>
        </div>
        <AdminOwnerSelect
          id="r-owner"
          v-model="form.ownerId"
          label="Pemilik kartu (Marketing)"
          :error="errors.ownerId"
        />
        <div class="flex flex-col gap-1.5">
          <Label for="r-page">Halaman tujuan</Label>
          <AdminNativeSelect id="r-page" v-model="form.pageId">
            <option value="">Nanti saja (tampilkan halaman umum)</option>
            <option v-for="p in pages.filter(p => !p.isDefault)" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </AdminNativeSelect>
        </div>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" class="h-11" @click="open = false">Batal</Button>
        <Button type="submit" form="register-cards" class="h-11" :disabled="saving">
          {{ saving ? 'Mendaftarkan…' : 'Daftarkan' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
