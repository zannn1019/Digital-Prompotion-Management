<script setup lang="ts">
import { Lock } from '@lucide/vue'
import { Button } from '@/components/ui/button'

definePageMeta({ layout: 'admin', middleware: 'auth', title: 'Akses ditolak' })
</script>

<template>
  <AdminEmptyState
    :level="1"
    :icon="Lock"
    title="Halaman ini khusus Super Admin"
    description="Akun Anda (Staff Konten) tidak memiliki akses ke halaman ini. Hubungi Super Admin bila Anda membutuhkannya."
  >
    <Button as-child class="h-11"><NuxtLink to="/admin">Ke Beranda</NuxtLink></Button>
  </AdminEmptyState>
</template>
