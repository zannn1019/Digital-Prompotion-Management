<script setup lang="ts">
import { ArrowRight, ImageUp, PenLine } from '@lucide/vue'

definePageMeta({ layout: 'admin', middleware: ['auth', 'canvas-editor'], title: 'Buat poster' })
// Starting fresh: drop anything left over from an earlier, unfinished hand-off.
useDesignDraft().value = null

const OPTIONS = [
  {
    to: '/admin/posters/upload',
    icon: ImageUp,
    title: 'Unggah poster jadi',
    text: 'Sudah punya poster dari aplikasi desain apa pun? Unggah file PNG, JPG, WebP, atau PDF di sini.',
    points: ['Paling cepat bila poster sudah ada', 'Tombol WhatsApp dan telepon ditambahkan di bawahnya'],
    cta: 'Unggah poster',
    primary: true,
  },
  {
    to: '/admin/posters/design',
    icon: PenLine,
    title: 'Desain sendiri di editor',
    text: 'Mulai dari contoh desain, ganti teks dan foto, geser sesuka hati. Logo dan kontak RS sudah terpasang.',
    points: ['Tanpa akun atau aplikasi lain', 'Ukuran pas untuk HP (4:5)'],
    cta: 'Buka editor',
    primary: false,
  },
]
</script>

<template>
  <div class="max-w-5xl">
    <AdminPageHeader
      title="Bagaimana Anda ingin membuat poster?"
      description="Pilih salah satu. Langkah berikutnya (tombol kontak dan jadwal) sama untuk keduanya."
      :back="{ to: '/admin/posters', label: 'Kembali ke daftar poster' }"
    />
    <div class="flex flex-wrap gap-6">
      <NuxtLink
        v-for="o in OPTIONS"
        :key="o.to"
        :to="o.to"
        :class="[
          'flex grow basis-[360px] flex-col gap-4 rounded-2xl bg-background p-7 transition hover:shadow-lg',
          o.primary ? 'border-[3px] border-zinc-900' : 'border-2',
        ]"
      >
        <span :class="['flex size-16 items-center justify-center rounded-2xl', o.primary ? 'bg-zinc-900 text-white' : 'bg-muted']">
          <component :is="o.icon" class="size-8" aria-hidden="true" />
        </span>
        <h2 class="text-2xl font-bold">{{ o.title }}</h2>
        <p class="text-[17px] leading-relaxed text-zinc-700">{{ o.text }}</p>
        <ul class="list-disc pl-5 text-base leading-relaxed text-zinc-700">
          <li v-for="p in o.points" :key="p">{{ p }}</li>
        </ul>
        <span
          :class="[
            'mt-auto flex min-h-14 items-center justify-center gap-2 rounded-xl text-lg font-semibold',
            o.primary ? 'bg-zinc-900 text-white' : 'border-2 border-zinc-900',
          ]"
        >
          {{ o.cta }}<ArrowRight class="size-5" aria-hidden="true" />
        </span>
      </NuxtLink>
    </div>
  </div>
</template>
