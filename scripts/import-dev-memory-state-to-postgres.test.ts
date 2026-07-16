import { describe, expect, test } from 'vitest'
import type { CashbookEntryData, FinanceAccountData } from '../server/http.js'
import {
  cashbookEntriesFromState,
  devMemoryProductCodeFromId,
  flattenNamedSalePriceRows,
  financeAccountsFromState,
  remapImportedOrderItemProductId,
  summarizeDevMemoryState,
} from './import-dev-memory-state-to-postgres.js'

describe('dev-memory to PostgreSQL import helpers', () => {
  test('counts finance accounts and cashbook entries in the import summary', () => {
    const state = {
      version: 1,
      financeAccounts: [['bank-0771000598653', financeAccount('bank-0771000598653')]],
      cashbookEntries: [['cashbook-1', cashbookEntry('cashbook-1')]],
    } as const

    expect(summarizeDevMemoryState(state)).toMatchObject({
      financeAccounts: 1,
      cashbookEntries: 1,
    })
  })

  test('keeps reviewed cashbook entry source and allocations from local state', () => {
    const entry = cashbookEntry('cashbook-tt001367')
    const state = {
      version: 1,
      cashbookEntries: [['cashbook-tt001367', entry]],
    } as const

    expect(cashbookEntriesFromState(state)).toEqual([entry])
    expect(cashbookEntriesFromState(state)[0].source?.order_code).toBe('HD008372')
    expect(cashbookEntriesFromState(state)[0].allocations?.[0]?.order_code).toBe('HD008372')
  })

  test('keeps reviewed finance accounts from local state', () => {
    const account = financeAccount('bank-0771000598653')
    const state = {
      version: 1,
      financeAccounts: [['bank-0771000598653', account]],
    } as const

    expect(financeAccountsFromState(state)).toEqual([account])
  })

  test('maps legacy dev-memory product ids to PostgreSQL product ids for imported order lines', () => {
    const idsByDevProductId = new Map([
      ['product-ib', 'uuid-in-bat'],
      ['product-sp000299-del', 'uuid-deleted-product'],
    ])

    expect(devMemoryProductCodeFromId('product-ib')).toBe('IB')
    expect(devMemoryProductCodeFromId('product-sp000299-del')).toBe('SP000299')
    expect(devMemoryProductCodeFromId('0d813d54-9bbe-4dfc-a58a-816120f168c9')).toBeNull()
    expect(remapImportedOrderItemProductId('product-ib', idsByDevProductId)).toBe('uuid-in-bat')
    expect(remapImportedOrderItemProductId('product-missing', idsByDevProductId)).toBe('product-missing')
  })

  test('flattens named price lists for PostgreSQL import', () => {
    expect(flattenNamedSalePriceRows([
      ['25', [['IB', 27000], ['DCI', 50000]]],
      ['40', [['IB', 40000]]],
    ])).toEqual([
      { product_code: 'IB', price_list_name: '25', unit_price: 27000 },
      { product_code: 'DCI', price_list_name: '25', unit_price: 50000 },
      { product_code: 'IB', price_list_name: '40', unit_price: 40000 },
    ])
  })
})

function financeAccount(id: string): FinanceAccountData {
  return {
    id,
    code: '0771000598653',
    name: '0771000598653',
    account_type: 'bank',
    is_default_cash: false,
    is_active: true,
    account_number: '0771000598653',
    account_holder: 'Van Lam',
    opening_balance: 0,
    note: null,
    notify_on_transaction: true,
  }
}

function cashbookEntry(id: string): CashbookEntryData {
  return {
    id,
    code: 'TT001367',
    status: 'posted',
    direction: 'in',
    amount_delta: 2136000,
    finance_account: {
      id: 'bank-0771000598653',
      code: '0771000598653',
      name: '0771000598653',
      account_type: 'bank',
    },
    is_business_accounted: true,
    source_type: 'kiotviet_cashbook',
    created_at: '2026-07-13T01:00:00.000Z',
    note: 'reviewed',
    counterparty: { type: 'customer', name: 'Khach test', phone: null },
    source: {
      type: 'kiotviet_cashbook',
      id: 'TT001367',
      code: 'TT001367',
      order_code: 'HD008372',
    },
    allocations: [{
      order_id: 'order-hd008372',
      order_code: 'HD008372',
      order_total_amount: 2136000,
      collected_before: 0,
      allocated_amount: 2136000,
      remaining_after: 0,
    }],
    payment_method: 'bank',
  }
}
