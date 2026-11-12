<script setup lang="ts">
// A laptop browser window on the video stage. With `admin`, it hosts a real admin screen inside
// the real admin layout (sidebar and header), at the size a laptop shows it.
import AdminLayout from '~/layouts/admin.vue'

const props = withDefaults(defineProps<{ admin?: boolean; width?: number; height?: number; label?: string; title?: string }>(), {
  admin: true,
  width: 1440,
  height: 900,
  label: 'Panel Admin · Poster Digital NFC',
  title: undefined,
})

// The layout names the page from the route; on /video every window shares one route,
// so each window puts its own page name in the header breadcrumb.
const el = ref<HTMLElement>()
onMounted(() => {
  const crumb = el.value?.querySelector('header b')
  if (crumb && props.title) crumb.textContent = props.title
})
</script>

<template>
  <div
    ref="el"
    class="video-window absolute overflow-hidden rounded-[18px] border border-[#dbe5ef] bg-background"
    :style="{ width: width + 'px', height: height + 'px' }"
  >
    <div class="flex h-[42px] items-center gap-2 border-b bg-[#eef3f8] px-[18px]">
      <span v-for="i in 3" :key="i" class="size-3 rounded-full bg-[#cfd8e3]" />
      <span class="ml-4 rounded-md bg-white px-4 py-1 text-[13px] text-muted-foreground">{{ label }}</span>
    </div>
    <div class="video-window-body relative overflow-hidden" :style="{ height: height - 42 + 'px', '--vw-h': height - 42 + 'px' }">
      <AdminLayout v-if="admin"><slot /></AdminLayout>
      <slot v-else />
    </div>
  </div>
</template>

<style>
.video-window {
  box-shadow:
    0 2px 6px rgb(15 23 42 / 5%),
    0 40px 100px rgb(15 23 42 / 14%);
}
/* The real layout sizes itself to the screen; inside the window it sizes to the window. */
.video-window-body .min-h-screen {
  min-height: 100%;
}
.video-window-body .h-screen {
  height: var(--vw-h);
}
</style>
