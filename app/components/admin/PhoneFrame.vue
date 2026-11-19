<template>
  <div class="mx-auto w-full max-w-full rounded-[44px] bg-primary p-2 shadow-xl">
    <div
      class="phone-frame-scroll h-[750px] overflow-x-hidden overflow-y-auto overscroll-contain scroll-smooth rounded-[34px] bg-[#07070c]"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.phone-frame-scroll {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.phone-frame-scroll::-webkit-scrollbar {
  display: none;
}
</style>
