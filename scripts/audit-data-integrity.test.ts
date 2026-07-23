import { describe, expect, it } from 'vitest'
import { auditQueries, countBySeverity, findingFromRows } from './audit-data-integrity'

describe('data integrity audit helpers', () => {
  it('counts findings by severity', () => {
    expect(countBySeverity([
      { check_id: 'A', severity: 'critical', domain: 'sales', summary: '', count: 2, records: [], truncated: false },
      { check_id: 'B', severity: 'high', domain: 'debt', summary: '', count: 3, records: [], truncated: false },
      { check_id: 'C', severity: 'info', domain: 'inventory', summary: '', count: 4, records: [], truncated: false },
    ])).toEqual({ critical: 2, high: 3, medium: 0, info: 4 })
  })

  it('keeps only sample records and marks truncation', () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({ id: index }))
    const finding = findingFromRows(auditQueries[0], rows)
    expect(finding.count).toBe(101)
    expect(finding.records).toHaveLength(100)
    expect(finding.truncated).toBe(true)
  })

  it('defines unique read-only checks with required table metadata', () => {
    const checkIds = auditQueries.map((query) => query.check_id)
    const domains = new Set(auditQueries.map((query) => query.domain))
    const writeKeyword = /\b(insert|update|delete|truncate|alter|drop|create|grant|revoke)\b/i

    expect(auditQueries.length).toBeGreaterThanOrEqual(15)
    expect(new Set(checkIds).size).toBe(checkIds.length)
    expect(domains).toEqual(new Set(['sales', 'debt', 'finance', 'purchase', 'inventory']))
    expect(auditQueries.every((query) => query.tables.length > 0 && /^select /i.test(query.sql.trim()))).toBe(true)
    expect(auditQueries.every((query) => !writeKeyword.test(query.sql))).toBe(true)
  })
})
