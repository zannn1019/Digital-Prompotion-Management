import type { Role, User } from '#shared/types'

// Who may call an admin route. Pure logic, no auto-imports, so tests can use it.

/** Message for a user who still has a temporary password. */
export const MUST_CHANGE_PASSWORD = 'Ganti kata sandi sementara Anda terlebih dahulu.'

/** Message for staff who try to put an emergency announcement live or change one that is. */
export const EMERGENCY_SUPER_ONLY =
  'Pengumuman darurat hanya bisa diterbitkan atau diubah oleh Super Admin. Simpan sebagai draft, lalu minta Super Admin menerbitkannya.'

/** A published (live or scheduled) emergency announcement: the one kind of content staff can't publish themselves. */
export function isLiveEmergency(
  p: { kind: string; status: string; level?: string | null; archived?: boolean } | null | undefined,
): boolean {
  return (
    !!p &&
    p.kind === 'pengumuman' &&
    p.level === 'darurat' &&
    p.status === 'published' &&
    !p.archived
  )
}

/**
 * Null when this user may make the change, else a 403. `before` is the announcement as saved (none when new),
 * `after` what it would become. Staff may draft emergency announcements, but publishing one, or changing,
 * extending, archiving or restoring one that is published, is for Super Admins.
 */
export function emergencyDenial(
  user: Pick<User, 'role'>,
  before: Parameters<typeof isLiveEmergency>[0],
  after: Parameters<typeof isLiveEmergency>[0],
): AccessDenial | null {
  if (user.role === 'super') return null
  return isLiveEmergency(before) || isLiveEmergency(after)
    ? { statusCode: 403, statusMessage: EMERGENCY_SUPER_ONLY }
    : null
}

export interface AccessDenial {
  statusCode: 401 | 403
  statusMessage: string
  data?: { mustChangePassword: true }
}

/**
 * Null when the user may go on. Someone signed in with a temporary password can only change it:
 * every other route answers 403 until they do (`allowPasswordChange` is for the change route itself).
 */
export function accessDenial(
  user: User | null,
  role?: Role,
  opts: { allowPasswordChange?: boolean } = {},
): AccessDenial | null {
  if (!user) return { statusCode: 401, statusMessage: 'Silakan masuk terlebih dahulu.' }
  if (user.mustChangePassword && !opts.allowPasswordChange)
    return {
      statusCode: 403,
      statusMessage: MUST_CHANGE_PASSWORD,
      data: { mustChangePassword: true },
    }
  if (role === 'super' && user.role !== 'super')
    return { statusCode: 403, statusMessage: 'Halaman ini khusus Super Admin.' }
  return null
}

/** Approvers and Super Admins publish directly and review what others submit. */
export function canApprove(user: Pick<User, 'role'> | null | undefined): boolean {
  return user?.role === 'super' || user?.role === 'approver'
}

/**
 * Whether a save waits for approval instead of going live. Staff and Marketing can draft, unpublish and
 * archive freely, but anything that would be published (new, edited or extended) needs an Approver.
 */
export function needsApproval(user: Pick<User, 'role'>, after: { status: string }): boolean {
  return !canApprove(user) && after.status === 'published'
}

/** Message for someone who may not review submissions. */
export const APPROVER_ONLY = 'Hanya Approver atau Super Admin yang bisa menyetujui.'

/** Message when the chosen owner isn't an active Marketing user. */
export const OWNER_NOT_MARKETING = 'Pilih pengguna dengan peran Marketing yang masih aktif.'

/**
 * Who should own a poster, page or card after a save. `requested` is what the form sent: undefined
 * keeps `current` (a new item goes to its creator when they are Marketing), null clears it, an id
 * must be an active Marketing user (`found` is that user, looked up by the caller) unless it is
 * already the owner, so an owner who left can stay on old items. Returns the id, or an error message.
 */
export function pickOwner(
  requested: string | null | undefined,
  me: Pick<User, 'id' | 'role'>,
  current: string | null | undefined,
  found: Pick<User, 'role' | 'status'> | null,
): { ownerId: string | null } | { error: string } {
  if (requested === undefined)
    return { ownerId: current !== undefined ? current : me.role === 'marketing' ? me.id : null }
  if (requested === null || requested === current) return { ownerId: requested }
  if (!found || found.role !== 'marketing' || found.status !== 'active')
    return { error: OWNER_NOT_MARKETING }
  return { ownerId: requested }
}

type Contact = Pick<User, 'role' | 'status' | 'email' | 'wa' | 'phone'>

/** The poster owner whose contact visitors get: only an active Marketing user (else Settings is used). */
export function contactOwner<T extends Contact>(owner: T | null | undefined): T | null {
  return owner && owner.role === 'marketing' && owner.status === 'active' ? owner : null
}

/**
 * Where a poster's WhatsApp, phone and email buttons go: its marketing user's own details, each
 * falling back to Settings when that user has none (or the poster has no active marketing user).
 */
export function contactNumbers(
  owner: Contact | null | undefined,
  settings: { wa: string; phone: string; email: string },
): { wa: string; phone: string; email: string } {
  const o = contactOwner(owner)
  return {
    wa: o?.wa || settings.wa,
    phone: o?.phone || settings.phone,
    email: o?.email || settings.email,
  }
}
