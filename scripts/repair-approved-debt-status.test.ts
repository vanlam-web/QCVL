import { describe, expect, it } from 'vitest'
import { approvedDebtRepairs, validateApprovedDebtRepairs } from './repair-approved-debt-status'

describe('approved debt status repair', () => {
  it('locks scope to the two owner-approved invoices', () => {
    expect(validateApprovedDebtRepairs()).toEqual(approvedDebtRepairs)
    expect(approvedDebtRepairs).toEqual([
      { code: 'HD011228', expected_order_status: 'cancelled', expected_debt_status: 'open', expected_remaining_debt: 206230, next_debt_status: 'closed', next_remaining_debt: 0 },
      { code: 'HD011198', expected_order_status: 'completed', expected_debt_status: 'open', expected_remaining_debt: 0, next_debt_status: 'closed', next_remaining_debt: 0 },
    ])
  })

  it('rejects missing or extra repair scope', () => {
    expect(() => validateApprovedDebtRepairs(approvedDebtRepairs.slice(0, 1))).toThrow('Expected exactly 2')
    expect(() => validateApprovedDebtRepairs([...approvedDebtRepairs, approvedDebtRepairs[0]])).toThrow('Expected exactly 2')
  })

  it('rejects replacement invoice codes', () => {
    expect(() => validateApprovedDebtRepairs([
      approvedDebtRepairs[0],
      { ...approvedDebtRepairs[1], code: 'HD999999' },
    ])).toThrow('scope changed')
  })
})
