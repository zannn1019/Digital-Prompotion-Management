<script setup lang="ts">
// List filter by marketing user: '' = everyone, 'none' = nobody assigned yet, else a user id.
// A Marketing user gets "Milik saya" first.
const model = defineModel<string>({ default: '' })
defineProps<{ id: string }>()
const { marketers } = useMarketingUsers()
const { user } = useSession()
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-sm leading-none font-medium">Marketing</label>
    <AdminNativeSelect :id="id" v-model="model">
      <option value="">Semua marketing</option>
      <option v-if="user?.role === 'marketing'" :value="user.id">Milik saya</option>
      <option v-for="m in marketers" :key="m.id" :value="m.id">{{ m.name }}</option>
      <option value="none">Belum ditentukan</option>
    </AdminNativeSelect>
  </div>
</template>
