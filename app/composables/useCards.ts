import { toast } from 'vue-sonner'
import type { Card } from '#shared/types'

export type CardRow = Card & { pageName: string | null; writtenByName: string | null; url: string }

/** Card list plus the bulk actions, shared by the card pages. */
export function useCards() {
  const { data, status, refresh } = useFetch<CardRow[]>('/api/cards', { key: 'cards', server: false })

  async function bulk(action: 'map' | 'deactivate' | 'activate', codes: string[], pageId: string | null = null, pageName = 'Halaman umum') {
    try {
      await $fetch('/api/cards/bulk', { method: 'POST', body: { action, codes, pageId } })
      await refresh()
      toast.success(
        action === 'map'
          ? `${codes.length} kartu dipetakan ke “${pageName}”.`
          : action === 'deactivate'
            ? `${codes.length} kartu dinonaktifkan.`
            : 'Kartu diaktifkan kembali.',
      )
      return true
    } catch (e: any) {
      toast.error(e?.data?.statusMessage ?? 'Gagal menyimpan. Coba lagi.')
      return false
    }
  }

  return { cards: data, status, refresh, bulk }
}
