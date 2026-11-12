import type { MaybeRefOrGetter } from 'vue'
import type { Poster, PublicView, Settings } from '#shared/types'

/** Builds the PublicView the admin phone previews render, from settings plus the posters shown. */
export function usePosterPreview(input: MaybeRefOrGetter<{ posters: Poster[]; announcements?: Poster[] }>) {
  const { data: settings } = useFetch<Settings>('/api/settings', { key: 'settings', server: false })
  return computed<PublicView | null>(() => {
    if (!settings.value) return null
    const v = toValue(input)
    return { kind: 'page', posters: v.posters, announcements: v.announcements ?? [], settings: settings.value }
  })
}

/** A blank poster object for previews of unsaved forms. */
export function draftPoster(fields: Partial<Poster>): Poster {
  return {
    id: 'preview',
    kind: 'gambar',
    name: '',
    status: 'published',
    archived: false,
    start: '',
    end: '',
    updatedAt: '',
    updatedBy: '',
    ...fields,
  }
}
