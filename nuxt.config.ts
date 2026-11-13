import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['shadcn-nuxt', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['@lucide/vue', 'clsx', 'tailwind-merge', 'vue-sonner', 'class-variance-authority', '@vueuse/core', 'reka-ui'],
    },
  },
  shadcn: { prefix: '', componentDir: './app/components/ui' },
  runtimeConfig: {
    // Trust X-Forwarded-For (right-most entry) for rate limiting. Only when running behind our own proxy:
    // NUXT_TRUST_PROXY=true. Off, the socket address is used and the header is ignored.
    trustProxy: false,
    // PostgreSQL connection, e.g. postgres://poster:…@db:5432/poster_nfc (NUXT_DATABASE_URL). Server-only.
    databaseUrl: '',
    // Folder for uploaded files (NUXT_UPLOAD_DIR). Empty: `.data/uploads` next to the app. Docker: /app/uploads (a volume).
    uploadDir: '',
    public: {
      // The canvas editor is built but outside the V1 scope agreed with the client (upload only).
      // Turn on with NUXT_PUBLIC_CANVAS_EDITOR=true.
      canvasEditor: false,
      // The product demo video studio at /video (dev only). Turn on with NUXT_PUBLIC_VIDEO_STUDIO=true.
      videoStudio: false,
      // The site's public address, e.g. https://poster.rs-bethesda.co.id (NUXT_PUBLIC_SITE_URL).
      // Used for absolute links such as the "continue on your phone" QR code, and as the only accepted
      // Origin for API writes. Without it, production shows no QR code rather than trust the Host header.
      siteUrl: '',
      // Demo buttons on the login page (sign in as a seeded account). On for the client demo;
      // switch off with NUXT_PUBLIC_DEMO_LOGIN=false.
      demoLogin: true,
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
  routeRules: {
    // Admin runs as a client-side app; public posters stay server-rendered for weak signal.
    '/admin/**': { ssr: false },
    '/video': { ssr: false },
    '/k/**': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
  },
})
