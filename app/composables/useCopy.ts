import { toast } from 'vue-sonner'

/** Copies text and confirms with a toast (or explains when the browser blocks it). */
export function useCopy() {
  async function copy(text: string, message = 'Alamat disalin.') {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(message)
    } catch {
      toast.error('Browser tidak mengizinkan menyalin. Pilih teksnya lalu tekan Ctrl+C.')
    }
  }
  return { copy }
}
