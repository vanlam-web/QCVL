import { describe, expect, test } from 'vitest'
import { adminUsernameFromEmail, planMigrations } from './db-migrate.mjs'

describe('planMigrations', () => {
  test('returns migrations not yet applied in lexical order', () => {
    const files = ['0002_sales_finance.sql', '0001_foundation.sql']
    const applied = new Set(['0001_foundation.sql'])
    expect(planMigrations(files, applied)).toEqual(['0002_sales_finance.sql'])
  })

  test('does not return already applied migrations', () => {
    const files = ['0001_foundation.sql']
    const applied = new Set(['0001_foundation.sql'])
    expect(planMigrations(files, applied)).toEqual([])
  })

  test('ignores files that are not migration sql files', () => {
    const files = ['README.md', 'draft.sql', '0002_sales_finance.sql', '0001_foundation.sql']
    expect(planMigrations(files, new Set())).toEqual(['0001_foundation.sql', '0002_sales_finance.sql'])
  })

  test('uses admin as username for default admin email', () => {
    expect(adminUsernameFromEmail('admin@qc-oms.local')).toBe('admin')
  })
})
