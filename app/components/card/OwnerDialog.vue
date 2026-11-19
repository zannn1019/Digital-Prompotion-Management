<script setup lang="ts">
// Hand selected cards to a marketing user: their taps then count for that person in Analytics.
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ count: number; initialOwnerId?: string | null }>()
const emit = defineEmits<{ confirm: [ownerId: string | null] }>()

const ownerId = ref<string | null>(null)
watch(open, o => {
  if (o) ownerId.value = props.initialOwnerId ?? null
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Atur marketing untuk {{ count }} kartu</DialogTitle>
        <DialogDescription>
          Ketukan kartu ini dihitung untuk marketing yang dipilih di Analitik. Kartu tidak perlu
          ditulis ulang.
        </DialogDescription>
      </DialogHeader>
      <AdminOwnerSelect id="card-owner" v-model="ownerId" label="Pemilik kartu (Marketing)" />
      <DialogFooter>
        <Button variant="outline" class="h-11" @click="open = false">Batal</Button>
        <Button class="h-11" @click="emit('confirm', ownerId)">Simpan</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
