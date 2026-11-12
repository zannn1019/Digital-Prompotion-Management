<script setup lang="ts">
defineProps<{ id: string; message?: string }>()
</script>

<template>
  <p v-if="message" :id="id" class="text-sm font-medium text-destructive" aria-live="polite">{{ message }}</p>
</template>
