<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Card, Page } from '#shared/types'

const open = defineModel<boolean>('open', { required: true })
defineProps<{ pages: Page[]; groups: string[] }>()
const emit = defineEmits<{ registered: [] }>()

const blank = () => ({ count: 1, label: '', group: '', pageId: '' })
const form = reactive(blank())
const { errors, submit } = useFieldErrors()

async function register() {
  const res = await submit(() =>
    $fetch<Card[]>('/api/cards', { method: 'POST', body: { ...form, count: Number(form.count), pageId: form.pageId || null } }),
  )
  if (!res) return
  toast.success(`${res.length} kartu terdaftar. Tulis alamatnya ke kartu fisik lewat “Tulis ke kartu”.`)
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
        <DialogDescription>Kode acak dibuat otomatis untuk setiap kartu. Setelah itu, tulis alamatnya ke kartu fisik.</DialogDescription>
      </DialogHeader>
      <div class="flex flex-col gap-4">
        <AdminTextField id="r-count" v-model="form.count" type="number" label="Jumlah kartu (1–50)" :error="errors.count" />
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
        <div class="flex flex-col gap-1.5">
          <Label for="r-page">Halaman tujuan</Label>
          <AdminNativeSelect id="r-page" v-model="form.pageId">
            <option value="">Nanti saja (tampilkan halaman umum)</option>
            <option v-for="p in pages.filter(p => !p.isDefault)" :key="p.id" :value="p.id">{{ p.name }}</option>
          </AdminNativeSelect>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" class="h-11" @click="open = false">Batal</Button>
        <Button class="h-11" @click="register">Daftarkan</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
