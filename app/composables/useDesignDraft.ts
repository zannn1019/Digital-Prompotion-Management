import type { PosterDesign } from '#shared/design'
import { nowStamp } from '#shared/utils/format'
import type { UploadedFile } from '~/utils/upload'

/** Poster form fields kept while staff leave the form to edit the design (plain JSON copy). */
export type PosterFormFields = Record<string, unknown>

/**
 * Hands a design between the poster form and the canvas editor.
 * The form stashes its fields here before opening the editor; the editor
 * adds the design and its exported image, then returns to the form.
 */
export interface DesignDraft {
  posterId?: string
  design?: PosterDesign
  file?: UploadedFile
  form?: PosterFormFields
}

export const useDesignDraft = () => useState<DesignDraft | null>('design-draft', () => null)

/** Where the editor returns to when it is done. */
export const draftReturnPath = (draft: DesignDraft | null) =>
  draft?.posterId ? `/admin/posters/${draft.posterId}` : '/admin/posters/upload'

const AUTOSAVE_KEY = 'nfc-poster-design-autosave'

/** Last unfinished design in this browser, so a closed tab does not lose work. Storage may be blocked. */
export const designAutosave = {
  read(): { design: PosterDesign; savedAt: string } | null {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  write(design: PosterDesign) {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ design, savedAt: nowStamp() }))
    } catch {
      /* storage full or blocked: autosave is a convenience only */
    }
  },
  clear() {
    try {
      localStorage.removeItem(AUTOSAVE_KEY)
    } catch {
      /* ignore */
    }
  },
}
