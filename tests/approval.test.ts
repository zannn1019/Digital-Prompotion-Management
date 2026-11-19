// Approval flow: who must submit for approval and who reviews. Pure logic; the database round trip
// (live poster unchanged until approval) is in tests/db/content.db.test.ts.
import { describe, expect, it } from 'vitest'
import { canApprove, emergencyDenial, needsApproval } from '../server/utils/access'
import { rejectSchema, userCreateSchema } from '../server/utils/validation'
import { ROLE_LABEL } from '#shared/constants'

describe('approver role', () => {
  it('exists and can be given to users', () => {
    expect(ROLE_LABEL.approver).toBe('Approver')
    expect(
      userCreateSchema.safeParse({ name: 'Ani', email: 'ani@rs.test', role: 'approver' }).success,
    ).toBe(true)
  })

  it('Approvers and Super Admins review; Staff and Marketing do not', () => {
    expect(canApprove({ role: 'approver' })).toBe(true)
    expect(canApprove({ role: 'super' })).toBe(true)
    expect(canApprove({ role: 'staff' })).toBe(false)
    expect(canApprove({ role: 'marketing' })).toBe(false)
    expect(canApprove(null)).toBe(false)
  })
})

describe('what needs approval', () => {
  it('Staff and Marketing publishing (new, edited or extended) wait for an Approver', () => {
    for (const role of ['staff', 'marketing'] as const)
      expect(needsApproval({ role }, { status: 'published' })).toBe(true)
  })

  it('drafts, unpublishing and archiving never wait', () => {
    for (const role of ['staff', 'marketing'] as const)
      expect(needsApproval({ role }, { status: 'draft' })).toBe(false)
  })

  it('Approvers and Super Admins publish directly', () => {
    for (const role of ['approver', 'super'] as const)
      expect(needsApproval({ role }, { status: 'published' })).toBe(false)
  })

  it('approving a live emergency announcement stays a Super Admin decision', () => {
    const emergency = { kind: 'pengumuman', status: 'published', level: 'darurat', archived: false }
    expect(emergencyDenial({ role: 'approver' }, null, emergency)?.statusCode).toBe(403)
    expect(emergencyDenial({ role: 'super' }, null, emergency)).toBeNull()
  })
})

describe('rejecting', () => {
  it('needs a short reason', () => {
    expect(rejectSchema.safeParse({ note: 'Harga belum sesuai brosur.' }).success).toBe(true)
    expect(rejectSchema.safeParse({ note: '  ' }).success).toBe(false)
    expect(rejectSchema.safeParse({}).success).toBe(false)
    expect(rejectSchema.safeParse({ note: 'x'.repeat(301) }).success).toBe(false)
  })
})
