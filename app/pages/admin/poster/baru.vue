<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth', title: 'Unggah poster' })
const back = useRuntimeConfig().public.canvasEditor
  ? { to: '/admin/poster/buat', label: 'Kembali ke pilihan' }
  : { to: '/admin/poster', label: 'Kembali ke daftar konten' }
</script>

<template>
  <div>
    <AdminPageHeader title="Unggah poster" :back="back" />
    <AdminPosterForm />
  </div>
</template>
