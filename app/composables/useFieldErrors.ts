import { toast } from 'vue-sonner'

/**
 * After a failed check, moves keyboard focus to the first field marked aria-invalid and scrolls it into view,
 * so the person sees (and a screen reader announces) what to fix instead of staying on the save button.
 */
export async function focusFirstError() {
  await nextTick()
  const el = document.querySelector<HTMLElement>('[aria-invalid="true"]')
  if (!el) return
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el.focus({ preventScroll: true })
}

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
        void focusFirstError()
      } else {
        toast.error(e?.data?.statusMessage || e?.statusMessage || 'Gagal menyimpan. Periksa koneksi, lalu coba lagi.')
      }
      return null
    }
  }

  return { errors, submit }
}
