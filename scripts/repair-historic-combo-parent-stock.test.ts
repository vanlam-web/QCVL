import pg from 'pg'
import { describe, expect, it, vi } from 'vitest'

const connect = vi.fn()
vi.mock('pg', () => ({ default: { Client: vi.fn(() => ({ connect, query: vi.fn(), end: vi.fn() })) } }))

const { repairHistoricComboParentStock } = await import('./repair-historic-combo-parent-stock.js')

describe('repairHistoricComboParentStock', () => {
  it('requires database URL before opening a connection', async () => {
    await expect(repairHistoricComboParentStock('', false)).rejects.toThrow('DATABASE_URL is required.')
    expect(connect).not.toHaveBeenCalled()
  })
})
void pg