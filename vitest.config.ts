import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests for pure logic (shared rules, server validation, helpers), plus database tests in tests/db
// that run only when TEST_DATABASE_URL is set. Those share one test database, so files run one at a time.
export default defineConfig({
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: { include: ['tests/**/*.test.ts'], fileParallelism: false },
})
