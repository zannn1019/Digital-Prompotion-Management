<template>
  <div class="mx-auto w-full max-w-full rounded-[44px] bg-primary p-2 shadow-xl">
    <div
      class="phone-frame-scroll h-[750px] overflow-y-auto overflow-x-hidden overscroll-contain rounded-[34px] bg-[#07070c] scroll-smooth"
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
