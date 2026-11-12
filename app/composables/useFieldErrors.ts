import { toast } from 'vue-sonner'

/**
 * Field errors from a 422 response (`data.errors`), plus a helper that runs a
 * request and shows a toast for anything else.
 */
export function useFieldErrors() {
  const errors = ref<Record<string, string>>({})

  async function submit<T>(fn: () => Promise<T>): Promise<T | null> {
    errors.value = {}
    try {
      return await fn()
    } catch (e: any) {
      const fieldErrors = e?.data?.data?.errors
      if (fieldErrors) {
        errors.value = fieldErrors
        const n = Object.keys(fieldErrors).length
        toast.error(`Ada ${n} isian yang perlu diperbaiki. Lihat tanda merah.`)
      } else {
        toast.error(e?.data?.statusMessage || e?.statusMessage || 'Gagal menyimpan. Periksa koneksi, lalu coba lagi.')
      }
      return null
    }
  }

  return { errors, submit }
}
