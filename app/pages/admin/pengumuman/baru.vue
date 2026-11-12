<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth', title: 'Buat pengumuman' })
</script>

<template>
  <div>
    <AdminPageHeader
      title="Buat pengumuman penting"
      description="Bar berwarna di bagian atas semua poster. Tidak perlu gambar — cukup ketik satu kalimat."
      :back="{ to: '/admin/poster', label: 'Kembali ke daftar poster' }"
    />
    <AdminAnnouncementForm />
  </div>
</template>
