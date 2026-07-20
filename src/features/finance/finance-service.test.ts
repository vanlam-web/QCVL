import { describe, expect, it } from 'vitest'
import { buildCashbookCsv, createFinanceService } from './finance-service'
import type { FinanceApiRequester } from './finance-service'

describe('finance-service', () => {
  it('builds debt and cashbook list filters', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: FinanceApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return { items: [], page: 2, page_size: 20, total: 0 } as T
    }
    const service = createFinanceService({ request })

    await service.listCustomerDebts({ search: 'an', page: 2, page_size: 20 })
    await service.listCashbookEntries({
      search: 'PT0001',
      search_scope: 'code',
      finance_account_id: 'bank-1',
      finance_account_type: 'bank',
      direction: 'in',
      status: 'posted',
      is_business_accounted: false,
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-31T23:59:59.999Z',
      page: 3,
      page_size: 15,
    })
    await service.getCashbookEntry('entry-1')
    await service.getSalesDocumentByCode('HD000020')

    expect(calls).toEqual([
      ['/api/v1/finance/customer-debts?search=an&page=2&page_size=20', undefined],
      [
        '/api/v1/finance/cashbook?search=PT0001&search_scope=code&finance_account_id=bank-1&finance_account_type=bank&direction=in&status=posted&is_business_accounted=false&from=2026-07-01T00%3A00%3A00.000Z&to=2026-07-31T23%3A59%3A59.999Z&page=3&page_size=15',
        undefined,
      ],
      ['/api/v1/finance/cashbook/entry-1', undefined],
      ['/api/v1/sales-documents?search=HD000020&type=invoice&page=1&page_size=1', undefined],
    ])
  })

  it('patches cashbook entries', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: FinanceApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return { id: 'entry-1' } as T
    }
    const service = createFinanceService({ request })

    await service.updateCashbookEntry('entry-1', {
      created_at: '2026-07-14T08:15:00.000Z',
      finance_account_id: 'bank-1',
      note: 'Sửa phiếu',
    })

    expect(calls).toEqual([
      [
        '/api/v1/finance/cashbook/entry-1',
        {
          method: 'PATCH',
          body: JSON.stringify({
            created_at: '2026-07-14T08:15:00.000Z',
            finance_account_id: 'bank-1',
            note: 'Sửa phiếu',
          }),
        },
      ],
    ])
  })

  it('posts debt collection payload', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: FinanceApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return { payment_receipt_id: 'receipt-1', allocated_amount: 500000 } as T
    }
    const service = createFinanceService({ request })

    await service.collectCustomerDebt({
      customer_id: 'customer-1',
      amount: 500000,
      payment_method: {
        cash_amount: 200000,
        bank_amount: 300000,
        bank_account_id: 'bank-1',
        bank_transaction_ref: 'MB-123',
      },
      note: 'Khách trả nợ',
    })

    expect(calls).toEqual([
      [
        '/api/v1/finance/debt-collections',
        {
          method: 'POST',
          body: JSON.stringify({
            customer_id: 'customer-1',
            amount: 500000,
            payment_method: {
              cash_amount: 200000,
              bank_amount: 300000,
              bank_account_id: 'bank-1',
              bank_transaction_ref: 'MB-123',
            },
            note: 'Khách trả nợ',
          }),
        },
      ],
    ])
  })

  it('posts manual cashbook voucher payload', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: FinanceApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return { id: 'voucher-1', code: 'PC000001', source_type: 'manual_voucher', status: 'posted', amount: 45000 } as T
    }
    const service = createFinanceService({ request })

    await service.createCashbookVoucher({
      voucher_direction: 'out',
      voucher_type: 'staff_salary',
      finance_account_id: 'cash-1',
      amount: 45000,
      partner_debt_mode: 'not_affect_partner_debt',
      is_business_accounted: false,
      counterparty_type: 'employee',
      counterparty_name: 'Nguyen Van A',
      counterparty_phone: '0900000000',
      reason: 'Mua văn phòng phẩm',
    })

    expect(calls).toEqual([
      [
        '/api/v1/finance/cashbook-vouchers',
        {
          method: 'POST',
          body: JSON.stringify({
            voucher_direction: 'out',
            voucher_type: 'staff_salary',
            finance_account_id: 'cash-1',
            amount: 45000,
            partner_debt_mode: 'not_affect_partner_debt',
            is_business_accounted: false,
            counterparty_type: 'employee',
            counterparty_name: 'Nguyen Van A',
            counterparty_phone: '0900000000',
            reason: 'Mua văn phòng phẩm',
          }),
        },
      ],
    ])
  })

  it('posts manual cashbook voucher cancel', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: FinanceApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return { id: 'voucher-1', code: 'PC000001', source_type: 'manual_voucher', status: 'cancelled', amount: 45000 } as T
    }
    const service = createFinanceService({ request })

    await service.cancelCashbookVoucher('voucher-1')

    expect(calls).toEqual([
      ['/api/v1/finance/cashbook-vouchers/voucher-1/cancel', { method: 'POST' }],
    ])
  })

  it('creates and updates finance accounts through API', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: FinanceApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return { id: 'bank-1', code: 'VCB', name: 'Vietcombank', account_type: 'bank', is_default_cash: false, is_active: false } as T
    }
    const service = createFinanceService({ request })

    await service.createFinanceAccount({
      code: 'VCB',
      name: 'Vietcombank',
      account_type: 'bank',
      is_default_cash: false,
      is_active: true,
      account_number: '0771000598653',
      account_holder: 'VAN VIET PHUONG LAM',
      opening_balance: 0,
      notify_on_transaction: true,
    })
    await service.updateFinanceAccount('bank-1', { is_active: false })

    expect(calls).toEqual([
      [
        '/api/v1/finance/accounts',
        {
          method: 'POST',
          body: JSON.stringify({
            code: 'VCB',
            name: 'Vietcombank',
            account_type: 'bank',
            is_default_cash: false,
            is_active: true,
            account_number: '0771000598653',
            account_holder: 'VAN VIET PHUONG LAM',
            opening_balance: 0,
            notify_on_transaction: true,
          }),
        },
      ],
      [
        '/api/v1/finance/accounts/bank-1',
        {
          method: 'PATCH',
          body: JSON.stringify({ is_active: false }),
        },
      ],
    ])
  })

  it('posts manual cashbook voucher revise payload', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: FinanceApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return { id: 'voucher-2', code: 'PC000001.01', source_type: 'manual_voucher', status: 'posted', amount: 50000 } as T
    }
    const service = createFinanceService({ request })

    await service.reviseCashbookVoucher('voucher-1', {
      voucher_direction: 'out',
      voucher_type: 'supplier_payment',
      finance_account_id: 'cash-1',
      amount: 50000,
      partner_debt_mode: 'affects_partner_debt',
      is_business_accounted: false,
      counterparty_type: 'employee',
      counterparty_name: 'Nguyen Van A',
      counterparty_phone: '0900000000',
      reason: 'Sửa phiếu chi',
    })

    expect(calls).toEqual([
      [
        '/api/v1/finance/cashbook-vouchers/voucher-1/revise',
        {
          method: 'POST',
          body: JSON.stringify({
            voucher_direction: 'out',
            voucher_type: 'supplier_payment',
            finance_account_id: 'cash-1',
            amount: 50000,
            partner_debt_mode: 'affects_partner_debt',
            is_business_accounted: false,
            counterparty_type: 'employee',
            counterparty_name: 'Nguyen Van A',
            counterparty_phone: '0900000000',
            reason: 'Sửa phiếu chi',
          }),
        },
      ],
    ])
  })

  it('calls KiotViet cashbook import endpoints', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const request: FinanceApiRequester['request'] = async <T>(path: string, init?: RequestInit) => {
      calls.push([path, init])
      return null as T
    }
    const service = createFinanceService({ request })
    const file = new File([new Uint8Array([1, 2, 3])], 'SoQuy_KV.xlsx')

    await service.previewKiotVietCashbookImport({ file })
    await service.importKiotVietCashbook({ file })
    await service.deleteImportedKiotVietCashbook()

    expect(calls.map(([path, init]) => [path, init?.method])).toEqual([
      ['/api/v1/finance/cashbook/import/kiotviet/preview', 'POST'],
      ['/api/v1/finance/cashbook/import/kiotviet', 'POST'],
      ['/api/v1/finance/cashbook/import/kiotviet', 'DELETE'],
    ])
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({
      file_name: 'SoQuy_KV.xlsx',
      file_base64: 'AQID',
    })
  })

  it('builds a cashbook CSV from visible rows', () => {
    expect(buildCashbookCsv([
      {
        id: 'entry-1',
        code: 'CTM001180',
        status: 'posted',
        direction: 'out',
        amount_delta: -30000,
        finance_account: { id: 'cash-1', code: 'CASH', name: 'Quỹ tiền mặt', account_type: 'cash' },
        is_business_accounted: true,
        source_type: 'cashbook_voucher',
        created_at: '2026-07-04T07:46:00.000Z',
        note: 'Vận chuyển',
        counterparty: { type: 'supplier', name: 'Thu Nghĩa', phone: '000100' },
      },
    ])).toBe([
      '\uFEFFMã phiếu,Thời gian,Người tạo,Loại phiếu,Số tài khoản,Người nộp/nhận,Giá trị,Ghi chú',
      'CTM001180,2026-07-04T07:46:00.000Z,,,,Thu Nghĩa,-30000,Vận chuyển',
    ].join('\n'))
  })
})
