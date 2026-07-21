import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { createDevMemoryRepository } from './dev-memory-repository'
import type { SalesDocumentData, ServerRepository } from './http'

type DevMemoryRepository = Awaited<ReturnType<typeof createDevMemoryRepository>>
type DevMemoryRepositoryWithHelpers = DevMemoryRepository & {
  createFinanceAccount: NonNullable<ServerRepository['createFinanceAccount']>
  updateFinanceAccount: NonNullable<ServerRepository['updateFinanceAccount']>
  listCustomers: NonNullable<ServerRepository['listCustomers']>
}

describe('createDevMemoryRepository persistence', () => {
  it('prefers an exact username over another user phone with the same value', async () => {
    const repository = await createDevMemoryRepository()

    await repository.updateUser?.({
      organizationId: 'org-dev-memory',
      id: 'user-dev-admin',
      phone: '0947900909',
    })
    await repository.createUser?.({
      organizationId: 'org-dev-memory',
      email: 'vanvietphuonglam@example.test',
      username: '0947900909',
      phone: '0947900000',
      birthday: null,
      region: null,
      ward: null,
      address: null,
      note: null,
      passwordHash: 'hash',
      displayName: 'Văn Viết Phương Lâm',
      permissions: ['perm.manage_users'],
    })

    const user = await repository.findUserByLogin?.('0947900909')

    expect(user?.id).toBe('user-dev-0947900909-2')
  })

  it('keeps admin session permissions complete when stored user permissions are stale', async () => {
    const repository = await createDevMemoryRepository()

    await repository.replaceUserPermissions?.({
      organizationId: 'org-dev-memory',
      id: 'user-dev-admin',
      permissions: ['perm.manage_users'],
    })

    const currentUser = await repository.getSessionUser('dev-token')

    expect(currentUser?.permissions).toContain('perm.manage_users')
    expect(currentUser?.permissions).toContain('perm.create_order')
    expect(currentUser?.permissions).toContain('perm.manage_finance')
  })

  it('returns edited admin display name for the current session user', async () => {
    const repository = await createDevMemoryRepository()

    await repository.updateUser?.({
      organizationId: 'org-dev-memory',
      id: 'user-dev-admin',
      displayName: 'Phạm Nhật Linh',
    })

    const currentUser = await repository.getSessionUser('dev-token')

    expect(currentUser?.user.display_name).toBe('Phạm Nhật Linh')
  })

  it('uses live invoice debt instead of stale imported customer debt in financial totals', async () => {
    const repository = await createDevMemoryRepository()

    await repository.upsertCustomersByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'DT',
        name: 'Dao Tuan',
        phone: null,
        email: null,
        address: null,
        area_name: null,
        ward_name: null,
        tax_code: null,
        customer_group_name: null,
        customer_group_id: null,
        note: null,
        customer_type: 'individual',
        company_name: null,
        source_creator_name: null,
        source_created_at: '2026-07-01T00:00:00.000Z',
        last_transaction_at: null,
        kiotviet_current_debt: 96000,
        kiotviet_total_sales: 4329360,
        kiotviet_net_sales: 4329360,
        status: 'active',
      }],
    })
    await repository.saveSalesDocument?.({
      organizationId: 'org-dev-memory',
      document: {
        id: 'order-dt-live',
        code: 'HD011155',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-13T12:21:00.000Z',
        customer: { id: 'customer-kv-dt', code: 'DT', name: 'Dao Tuan', phone: null },
        seller: { id: 'user-dev-admin', name: 'Admin' },
        subtotal_amount: 2919120,
        discount_amount: 0,
        total_amount: 2919120,
        paid_amount: 0,
        debt_amount: 2919120,
        payment_status: 'unpaid',
        note: null,
        items: [],
      },
      cashbookEntries: [],
    })

    const totals = await repository.getCustomerFinancialTotals?.('org-dev-memory')

    expect(totals?.get('customer-kv-dt')?.total_debt_amount).toBe(2919120)
  })

  it('filters sales documents by the displayed source date instead of shifting UTC into local date', async () => {
    const repository = await createDevMemoryRepository()

    await repository.saveSalesDocument?.({
      organizationId: 'org-dev-memory',
      document: {
        id: 'order-boundary',
        code: 'HD010985',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-06-30T17:08:52.330Z',
        customer: { id: 'customer-boundary', code: 'VCT', name: 'Vo Cong Tuan', phone: null },
        seller: { id: 'admin', name: 'Admin' },
        subtotal_amount: 368720,
        discount_amount: 0,
        total_amount: 368720,
        paid_amount: 0,
        debt_amount: 368720,
        payment_status: 'unpaid',
        note: null,
        items: [],
      },
      cashbookEntries: [],
    })

    const julyDocuments = await repository.listSalesDocuments?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/sales-documents?from=2026-07-01&to=2026-07-31&page=1&page_size=15'),
    })

    expect(julyDocuments?.map((document) => document.code)).not.toContain('HD010985')
  })

  it('returns current display names for saved sales and cashbook user snapshots', async () => {
    const repository = await createDevMemoryRepository()

    await repository.saveSalesDocument?.({
      organizationId: 'org-dev-memory',
      document: {
        id: 'order-display-user',
        code: 'HD-DISPLAY-USER',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-13T08:00:00.000Z',
        customer: { id: 'customer-display-user', code: 'KHTEST', name: 'Khach test', phone: null },
        seller: { id: 'user-dev-admin', name: 'Admin' },
        subtotal_amount: 100000,
        discount_amount: 0,
        total_amount: 100000,
        paid_amount: 100000,
        debt_amount: 0,
        payment_status: 'paid',
        note: null,
        items: [],
      },
      cashbookEntries: [{
        id: 'cashbook-display-user',
        code: 'TTHD-DISPLAY-USER',
        status: 'posted',
        direction: 'in',
        amount_delta: 100000,
        finance_account: { id: 'cash-main', code: 'TM', name: 'Tien mat', account_type: 'cash' },
        is_business_accounted: true,
        source_type: 'payment_receipt_method',
        created_at: '2026-07-13T08:00:00.000Z',
        note: null,
        counterparty: { type: 'customer', name: 'Khach test', phone: null },
        created_by: { id: 'user-dev-admin', name: 'Admin' },
        source: { type: 'payment_receipt', id: 'receipt-display-user', code: 'TTHD-DISPLAY-USER', order_code: 'HD-DISPLAY-USER' },
        allocations: [],
      }],
    })
    await repository.updateUser?.({
      organizationId: 'org-dev-memory',
      id: 'user-dev-admin',
      displayName: 'Phạm Nhật Linh',
    })

    const documents = await repository.listSalesDocuments?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/sales-documents?search=HD-DISPLAY-USER'),
    })
    const document = await repository.getSalesDocument?.({ organizationId: 'org-dev-memory', id: 'order-display-user' })
    const cashbook = await repository.getCashbookEntry?.({ organizationId: 'org-dev-memory', id: 'cashbook-display-user' })

    expect(documents?.[0]?.seller.name).toBe('Phạm Nhật Linh')
    expect(document?.seller.name).toBe('Phạm Nhật Linh')
    expect(document?.payment_receipts[0]?.created_by.name).toBe('Phạm Nhật Linh')
    expect(cashbook?.created_by?.name).toBe('Phạm Nhật Linh')
  })

  it('keeps linked payment receipt and cashbook time in sync with edited sales document time', async () => {
    const repository = await createDevMemoryRepository()

    await repository.saveSalesDocument?.({
      organizationId: 'org-dev-memory',
      document: {
        id: 'order-linked-time',
        code: 'HD-LINKED-TIME',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-13T08:00:00.000Z',
        customer: { id: 'customer-linked-time', code: 'KHTEST', name: 'Khach test', phone: null },
        seller: { id: 'user-dev-admin', name: 'Admin' },
        subtotal_amount: 100000,
        discount_amount: 0,
        total_amount: 100000,
        paid_amount: 100000,
        debt_amount: 0,
        payment_status: 'paid',
        note: null,
        items: [],
      },
      cashbookEntries: [{
        id: 'cashbook-linked-time',
        code: 'TTHD-LINKED-TIME',
        status: 'posted',
        direction: 'in',
        amount_delta: 100000,
        finance_account: { id: 'cash-main', code: 'TM', name: 'Tien mat', account_type: 'cash' },
        is_business_accounted: true,
        source_type: 'payment_receipt_method',
        created_at: '2026-07-13T08:00:00.000Z',
        note: null,
        counterparty: { type: 'customer', name: 'Khach test', phone: null },
        created_by: { id: 'user-dev-admin', name: 'Admin' },
        source: { type: 'payment_receipt', id: 'receipt-linked-time', code: 'TTHD-LINKED-TIME', order_code: 'HD-LINKED-TIME' },
        allocations: [],
      }],
    })

    await repository.updateSalesDocumentNote?.({
      organizationId: 'org-dev-memory',
      id: 'order-linked-time',
      created_at: '2026-07-18T04:15:00.000Z',
    })

    const document = await repository.getSalesDocument?.({ organizationId: 'org-dev-memory', id: 'order-linked-time' })
    const cashbook = await repository.getCashbookEntry?.({ organizationId: 'org-dev-memory', id: 'cashbook-linked-time' })

    expect(document?.created_at).toBe('2026-07-18T04:15:00.000Z')
    expect(document?.payment_receipts[0]?.created_at).toBe('2026-07-18T04:15:00.000Z')
    expect(cashbook?.created_at).toBe('2026-07-18T04:15:00.000Z')
  })

  it('filters cashbook entries by finance account id and account type', async () => {
    const repository = await createDevMemoryRepository()

    await repository.saveSalesDocument?.({
      organizationId: 'org-dev-memory',
      document: {
        id: 'order-cashbook-filter',
        code: 'HD-CASHBOOK-FILTER',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-13T08:00:00.000Z',
        customer: { id: 'customer-cashbook-filter', code: 'KHTEST', name: 'Khach test', phone: null },
        seller: { id: 'admin', name: 'Admin' },
        subtotal_amount: 0,
        discount_amount: 0,
        total_amount: 0,
        paid_amount: 0,
        debt_amount: 0,
        payment_status: 'paid',
        note: null,
        items: [],
      },
      cashbookEntries: [
        {
          id: 'cashbook-bank-a',
          code: 'PT-BANK-A',
          status: 'posted',
          direction: 'in',
          amount_delta: 100000,
          finance_account: { id: 'bank-a', code: '0771000598653', name: 'Van Viet Phuong Lam', account_type: 'bank' },
          is_business_accounted: true,
          source_type: 'kiotviet_cashbook',
          created_at: '2026-07-13T08:00:00.000Z',
          note: 'Bank A',
          counterparty: { type: 'other', name: 'Khach A', phone: null },
        },
        {
          id: 'cashbook-bank-b',
          code: 'PT-BANK-B',
          status: 'posted',
          direction: 'in',
          amount_delta: 200000,
          finance_account: { id: 'bank-b', code: '0947900909', name: 'van viet phuong lam', account_type: 'bank' },
          is_business_accounted: true,
          source_type: 'kiotviet_cashbook',
          created_at: '2026-07-13T08:01:00.000Z',
          note: 'Bank B',
          counterparty: { type: 'other', name: 'Khach B', phone: null },
        },
        {
          id: 'cashbook-cash',
          code: 'PT-CASH',
          status: 'posted',
          direction: 'in',
          amount_delta: 300000,
          finance_account: { id: 'cash-main', code: 'TM', name: 'Tien mat', account_type: 'cash' },
          is_business_accounted: true,
          source_type: 'kiotviet_cashbook',
          created_at: '2026-07-13T08:02:00.000Z',
          note: 'Cash',
          counterparty: { type: 'other', name: 'Khach cash', phone: null },
        },
      ],
    })

    const bankAEntries = await repository.listCashbookEntries?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/finance/cashbook?finance_account_id=bank-a&page=1&page_size=100'),
    })
    const bankEntries = await repository.listCashbookEntries?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/finance/cashbook?finance_account_type=bank&page=1&page_size=100'),
    })

    expect(bankAEntries?.map((entry) => entry.code)).toEqual(['PT-BANK-A'])
    expect(bankEntries?.map((entry) => entry.code).sort()).toEqual(['PT-BANK-A', 'PT-BANK-B'])
  })

  it('hydrates sales document payment history from linked cashbook entries', async () => {
    const repository = await createDevMemoryRepository()

    await repository.saveSalesDocument?.({
      organizationId: 'org-dev-memory',
      document: {
        id: 'order-hd-011137',
        code: 'HD011137',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-10T09:00:00.000Z',
        customer: { id: 'customer-kl4', code: 'KH-KL4', name: 'kl4', phone: null },
        seller: { id: 'seller-kv', name: 'KiotViet' },
        subtotal_amount: 3000000,
        discount_amount: 0,
        total_amount: 3000000,
        paid_amount: 1000000,
        debt_amount: 2000000,
        payment_status: 'partial',
        note: null,
        items: [],
      },
      cashbookEntries: [
        {
          id: 'cashbook-tthd-011137',
          code: 'TTHD011137',
          status: 'posted',
          direction: 'in',
          amount_delta: 1000000,
          finance_account: { id: 'bank-kv-0947900909', code: '0947900909', name: 'MBBank', account_type: 'bank', account_number: '0947900909' },
          is_business_accounted: true,
          source_type: 'kiotviet_cashbook',
          created_at: '2026-07-10T09:01:00.000Z',
          note: 'Thanh toan HD011137',
          counterparty: { type: 'customer', name: 'kl4', phone: null },
          source: { type: 'payment_receipt', id: 'cashbook-tthd-011137', code: 'TTHD011137', order_code: 'HD011137' },
          allocations: [{
            order_id: 'order-hd-011137',
            order_code: 'HD011137',
            order_total_amount: 3000000,
            collected_before: 0,
            allocated_amount: 1000000,
            remaining_after: 2000000,
          }],
        },
      ],
    })

    const detail = await repository.getSalesDocument?.({
      organizationId: 'org-dev-memory',
      id: 'HD011137',
    })

    expect(detail?.payment_receipts?.map((receipt) => receipt.code)).toEqual(['TTHD011137'])
    expect(detail?.payment_receipts?.[0]).toEqual(expect.objectContaining({
      total_received_amount: 1000000,
      methods: [expect.objectContaining({ method_type: 'bank_transfer', amount: 1000000 })],
    }))
  })

  it('hydrates cashbook finance account from the current bank account record', async () => {
    const repository = await createDevMemoryRepository()

    await (repository as DevMemoryRepositoryWithHelpers).createFinanceAccount({
      organizationId: 'org-dev-memory',
      account: {
        id: 'bank-kv-0947900909',
        code: 'MBBank',
        name: 'MBBank',
        account_type: 'bank',
        is_default_cash: false,
        is_active: true,
        account_number: '0947900909',
        account_holder: 'VAN VIET PHUONG LAM',
        opening_balance: 0,
        note: null,
        notify_on_transaction: true,
      },
    })
    await repository.saveSalesDocument?.({
      organizationId: 'org-dev-memory',
      document: {
        id: 'order-cashbook-account-hydration',
        code: 'HD-CASHBOOK-ACCOUNT-HYDRATION',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-13T08:00:00.000Z',
        customer: { id: 'customer-cashbook-account-hydration', code: 'KHTEST', name: 'Khach test', phone: null },
        seller: { id: 'admin', name: 'Admin' },
        subtotal_amount: 0,
        discount_amount: 0,
        total_amount: 0,
        paid_amount: 0,
        debt_amount: 0,
        payment_status: 'paid',
        note: null,
        items: [],
      },
      cashbookEntries: [
        {
          id: 'cashbook-bank-current-account',
          code: 'TTHD011149',
          status: 'posted',
          direction: 'in',
          amount_delta: 220000,
          finance_account: { id: 'bank-kv-0947900909', code: '0947900909', name: 'van viet phuong lam', account_type: 'bank' },
          is_business_accounted: true,
          source_type: 'kiotviet_cashbook',
          created_at: '2026-07-13T08:01:00.000Z',
          note: '',
          counterparty: { type: 'other', name: '', phone: null },
        },
      ],
    })

    const detail = await repository.getCashbookEntry?.({
      organizationId: 'org-dev-memory',
      id: 'cashbook-bank-current-account',
    })
    const items = await repository.listCashbookEntries?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/finance/cashbook?search=TTHD011149&page=1&page_size=10'),
    })

    expect(detail?.finance_account).toEqual(expect.objectContaining({
      code: '0947900909',
      name: 'MBBank',
      account_number: '0947900909',
      account_holder: 'VAN VIET PHUONG LAM',
    }))
    expect(items?.[0]?.finance_account).toEqual(expect.objectContaining({
      code: '0947900909',
      name: 'MBBank',
      account_number: '0947900909',
    }))
  })

  it('excludes replaced deleted bank accounts from broad bank cashbook filters', async () => {
    const repository = await createDevMemoryRepository()

    await (repository as DevMemoryRepositoryWithHelpers).createFinanceAccount({
      organizationId: 'org-dev-memory',
      account: {
        id: 'bank-active-successor',
        code: '7059359298',
        name: 'Active successor bank',
        account_type: 'bank',
        is_default_cash: false,
        is_active: true,
        account_number: '7059359298',
        account_holder: 'ACTIVE ACCOUNT',
        opening_balance: 0,
        note: null,
        notify_on_transaction: true,
      },
    })
    const deletedAccount = await (repository as DevMemoryRepositoryWithHelpers).createFinanceAccount({
      organizationId: 'org-dev-memory',
      account: {
        id: 'bank-deleted',
        code: '7059359298{DEL}',
        name: 'Deleted bank',
        account_type: 'bank',
        is_default_cash: false,
        is_active: false,
        account_number: '7059359298{DEL}',
        account_holder: 'OLD ACCOUNT',
        opening_balance: 0,
        note: null,
        notify_on_transaction: false,
      },
    })
    await repository.saveSalesDocument?.({
      organizationId: 'org-dev-memory',
      document: {
        id: 'order-cashbook-deleted-account',
        code: 'HD-CASHBOOK-DELETED-ACCOUNT',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-13T08:00:00.000Z',
        customer: { id: 'customer-cashbook-deleted-account', code: 'KHTEST', name: 'Khach test', phone: null },
        seller: { id: 'admin', name: 'Admin' },
        subtotal_amount: 0,
        discount_amount: 0,
        total_amount: 0,
        paid_amount: 0,
        debt_amount: 0,
        payment_status: 'paid',
        note: null,
        items: [],
      },
      cashbookEntries: [
        {
          id: 'cashbook-active-bank',
          code: 'PT-ACTIVE-BANK',
          status: 'posted',
          direction: 'in',
          amount_delta: 100000,
          finance_account: { id: 'bank-active', code: '0771000598653', name: 'Active bank', account_type: 'bank' },
          is_business_accounted: true,
          source_type: 'kiotviet_cashbook',
          created_at: '2026-07-13T08:00:00.000Z',
          note: 'Active',
          counterparty: { type: 'other', name: 'Khach A', phone: null },
        },
        {
          id: 'cashbook-deleted-bank',
          code: 'PT-DELETED-BANK',
          status: 'posted',
          direction: 'in',
          amount_delta: 50000000,
          finance_account: { id: deletedAccount.id, code: deletedAccount.account_number ?? deletedAccount.code, name: deletedAccount.name, account_type: 'bank' },
          is_business_accounted: true,
          source_type: 'kiotviet_cashbook',
          created_at: '2026-07-13T08:01:00.000Z',
          note: 'Deleted',
          counterparty: { type: 'other', name: 'Khach deleted', phone: null },
        },
      ],
    })

    const broadBankEntries = await repository.listCashbookEntries?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/finance/cashbook?finance_account_type=bank&exclude_replaced_deleted_accounts=true&page=1&page_size=100'),
    })
    const explicitDeletedEntries = await repository.listCashbookEntries?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/finance/cashbook?finance_account_id=bank-deleted&page=1&page_size=100'),
    })

    expect(broadBankEntries?.map((entry) => entry.code)).toEqual(['PT-ACTIVE-BANK'])
    expect(explicitDeletedEntries?.map((entry) => entry.code)).toEqual(['PT-DELETED-BANK'])
  })

  it('keeps the posted KiotViet cashbook row when an export repeats the same voucher with a cancelled audit row', async () => {
    const repository = await createDevMemoryRepository()

    await repository.upsertImportedKiotVietCashbook?.({
      organizationId: 'org-dev-memory',
      rows: [
        {
          rowNumber: 1775,
          source_code: 'TT001367',
          entry_time: '2026-01-29T16:29:00.000Z',
          source_created_at: '2026-01-29T16:29:17.063Z',
          source_creator_name: 'Van Viet Phuong Lam',
          staff_name: 'Van Viet Phuong Lam',
          category_name: 'Phieu thu Tien khach tra',
          account_type: 'bank',
          account_name: 'Ngan hang chua ro',
          account_number: null,
          counterparty_code: 'KH000452',
          counterparty_name: 'kiet dmx',
          counterparty_phone: null,
          counterparty_address: null,
          transfer_content: null,
          source_note: null,
          direction: 'in',
          amount_delta: 2136000,
          book_type_name: 'Ngan hang',
          status: 'posted',
        },
        {
          rowNumber: 1776,
          source_code: 'TT001367',
          entry_time: '2026-01-29T16:29:00.000Z',
          source_created_at: '2026-01-29T16:29:17.047Z',
          source_creator_name: 'Van Viet Phuong Lam',
          staff_name: 'Van Viet Phuong Lam',
          category_name: 'Phieu thu Tien khach tra',
          account_type: 'bank',
          account_name: 'Ngan hang chua ro',
          account_number: null,
          counterparty_code: 'KH000452',
          counterparty_name: 'kiet dmx',
          counterparty_phone: null,
          counterparty_address: null,
          transfer_content: null,
          source_note: null,
          direction: 'in',
          amount_delta: 216000,
          book_type_name: 'Ngan hang',
          status: 'cancelled',
        },
      ],
    })

    const postedEntries = await repository.listCashbookEntries?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/finance/cashbook?status=posted&search=TT001367&page=1&page_size=100'),
    })

    expect(postedEntries).toHaveLength(1)
    expect(postedEntries?.[0]).toMatchObject({
      code: 'TT001367',
      status: 'posted',
      amount_delta: 2136000,
    })
  })

  it('soft deletes finance accounts without removing them from the repository', async () => {
    const repository = await createDevMemoryRepository()

    const created = await (repository as DevMemoryRepositoryWithHelpers).createFinanceAccount({
      organizationId: 'org-dev-memory',
      account: {
        code: 'VCB',
        name: 'Vietcombank',
        account_type: 'bank',
        is_default_cash: false,
        is_active: true,
        account_number: '0771000598653',
        account_holder: 'VAN VIET PHUONG LAM',
        opening_balance: 0,
        note: null,
        notify_on_transaction: true,
      },
    })
    const updated = await (repository as DevMemoryRepositoryWithHelpers).updateFinanceAccount({
      organizationId: 'org-dev-memory',
      id: created.id,
      patch: { is_active: false },
    })
    const allAccounts = await repository.listFinanceAccounts?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/finance/accounts'),
    })
    const activeAccounts = await repository.listFinanceAccounts?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/finance/accounts?is_active=true'),
    })

    expect(updated?.is_active).toBe(false)
    expect(allAccounts?.some((account) => account.id === created.id && account.account_number === '0771000598653')).toBe(true)
    expect(activeAccounts?.some((account) => account.id === created.id)).toBe(false)
  })

  it('keeps imported products and stocktakes after repository restart when a state file is provided', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qcvl-dev-memory-'))
    const stateFile = join(dir, 'state.json')

    try {
      const first = await createDevMemoryRepository({ stateFile })
      const groupIds = await first.upsertProductGroupsByName?.({
        organizationId: 'org-dev-memory',
        names: ['Giấy in'],
      })
      await first.upsertProductsByCode?.({
        organizationId: 'org-dev-memory',
        rows: [
          {
            rowNumber: 2,
            code: 'PERSIST-HH',
            name: 'Hàng hóa giữ sau restart',
            product_group_name: 'Giấy in',
            product_group_id: groupIds?.get('Giấy in') ?? null,
            product_kind: 'goods',
            inventory_shape: 'normal',
            sell_method: 'quantity',
            track_inventory: true,
            unit_name: 'Cái',
            latest_purchase_cost: 1000,
            status: 'active',
            unit_conversions: [],
            sale_price: null,
            provisional_stock: null,
            bom_text: null,
            source_created_at: '2026-07-01T00:00:00.000Z',
            ignored: {
              brand: null,
              min_stock: null,
              max_stock: null,
              direct_sale: null,
              location: null,
            },
          },
        ],
      })
      await first.upsertImportedKiotVietStocktakes?.({
        organizationId: 'org-dev-memory',
        createdBy: { id: 'user-dev-admin', name: 'Admin' },
        rows: [
          {
            rowNumber: 2,
            source_code: 'KK-PERSIST',
            source_created_at: '2026-07-02T00:00:00.000Z',
            source_balanced_at: '2026-07-03T00:00:00.000Z',
            status: 'balanced',
            product_code: 'PERSIST-HH',
            product_name: 'Hàng hóa giữ sau restart',
            system_qty: 3,
            actual_qty: 4,
            difference_qty: 1,
            system_value: null,
            total_actual_value: null,
            total_difference_value: null,
            note: 'Persist stocktake',
          },
        ],
      })
      await first.close()

      const restarted = await createDevMemoryRepository({ stateFile })
      const products = await restarted.listProducts({
        organizationId: 'org-dev-memory',
        url: new URL('http://api.local/api/v1/products?search=PERSIST-HH'),
      })
      const stocktakes = await restarted.listStocktakes?.({
        organizationId: 'org-dev-memory',
        url: new URL('http://api.local/api/v1/inventory/stocktakes?search=KK-PERSIST'),
      })

      expect(products).toEqual([expect.objectContaining({ code: 'PERSIST-HH' })])
      expect(stocktakes).toEqual([expect.objectContaining({ code: 'KK-PERSIST' })])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('dedupes product groups with equivalent KiotViet paths for filter display', async () => {
    const repository = await createDevMemoryRepository()

    await repository.upsertProductGroupsByName?.({
      organizationId: 'org-dev-memory',
      names: ['Mica>>CNC', 'Mica >> CNC', 'Mica >> Vật tư'],
    })
    const groups = await repository.listProductGroups?.({ organizationId: 'org-dev-memory' })

    expect(groups?.map((group) => group.name)).toEqual(['Mica >> CNC', 'Mica >> Vật tư'])
  })

  it('persists imported price lists and deletes imported products without crashing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qcvl-dev-memory-'))
    const stateFile = join(dir, 'state.json')

    try {
      const repository = await createDevMemoryRepository({ stateFile })
      await repository.upsertProductsByCode?.({
        organizationId: 'org-dev-memory',
        rows: [
          {
            rowNumber: 2,
            code: 'PRICE-PERSIST',
            name: 'Hang co bang gia',
            product_group_name: null,
            product_group_id: null,
            product_kind: 'goods',
            inventory_shape: 'normal',
            sell_method: 'quantity',
            track_inventory: true,
            unit_name: 'Cai',
            latest_purchase_cost: 1000,
            status: 'active',
            unit_conversions: [],
            sale_price: null,
            provisional_stock: null,
            bom_text: null,
            source_created_at: null,
            ignored: {
              brand: null,
              min_stock: null,
              max_stock: null,
              direct_sale: null,
              location: null,
            },
          },
        ],
      })
      await repository.upsertPriceListItemsByName?.({
        organizationId: 'org-dev-memory',
        rows: [
          {
            rowNumber: 2,
            product_code: 'PRICE-PERSIST',
            price_list_name: '25',
            unit_price: 25000,
          },
        ],
      })

      const persisted = JSON.parse(await readFile(stateFile, 'utf8'))
      const result = await repository.deleteImportedKiotVietProducts?.({ organizationId: 'org-dev-memory' })
      await repository.close()
      const afterDelete = JSON.parse(await readFile(stateFile, 'utf8'))

      expect(persisted.priceListNames).toEqual(expect.arrayContaining([
        ['25', expect.objectContaining({ name: '25' })],
      ]))
      expect(persisted.namedSalePrices).toEqual(expect.arrayContaining([
        ['25', [['PRICE-PERSIST', 25000]]],
      ]))
      expect(result).toEqual({ deleted: 1, blocked: 0 })
      expect(afterDelete.priceListNames).toEqual(expect.arrayContaining([
        ['25', expect.objectContaining({ name: '25' })],
      ]))
      expect(afterDelete.namedSalePrices).toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('keeps existing product unit conversions when an import row has none', async () => {
    const repository = await createDevMemoryRepository()

    const baseRow = {
      code: 'F5',
      name: 'Fomex 5mm',
      status: 'active' as const,
      product_group_id: null,
      unit_name: 'Tấm',
      sell_method: 'quantity' as const,
      product_kind: 'goods' as const,
      inventory_shape: 'normal' as const,
      track_inventory: true,
      latest_purchase_cost: 126000,
      source_created_at: null,
      source: {} as never,
    }

    await repository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        ...baseRow,
        unit_conversions: [{
          source_code: '5mm Tấc',
          unit_name: 'Tấc',
          stock_qty_per_unit: 0.05,
          is_default_purchase_unit: true,
          is_default_sale_unit: false,
        }],
      }],
    })

    await repository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{ ...baseRow, latest_purchase_cost: 130000, unit_conversions: [] }],
    })

    const products = await repository.listProducts?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/products?search=F5&status=all'),
    })

    expect(products?.find((product) => product.code === 'F5')?.unit_conversions).toEqual([{
      source_code: '5mm Tấc',
      unit_name: 'Tấc',
      stock_qty_per_unit: 0.05,
      is_default_purchase_unit: true,
      is_default_sale_unit: false,
    }])
  })

  it('returns unit-conversion alias prices for POS price resolution', async () => {
    const repository = await createDevMemoryRepository()
    const baseRow = {
      name: 'Fomex 8mm',
      status: 'active' as const,
      product_group_id: null,
      unit_name: 'Tam',
      sell_method: 'quantity' as const,
      product_kind: 'goods' as const,
      inventory_shape: 'normal' as const,
      track_inventory: true,
      latest_purchase_cost: 100000,
      source_created_at: null,
      source: {} as never,
    }

    await repository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [
        {
          ...baseRow,
          code: 'F8',
          unit_conversions: [
            {
              source_code: 'F8-TAC',
              unit_name: 'Tac',
              stock_qty_per_unit: 0.05,
              is_default_purchase_unit: false,
              is_default_sale_unit: false,
            },
          ],
        },
        { ...baseRow, code: 'F8-TAC', unit_name: 'Tac', unit_conversions: [] },
      ],
    })
    await repository.upsertPriceListItemsByName?.({
      organizationId: 'org-dev-memory',
      defaultPriceListId: 'pl-default',
      rows: [
        { product_code: 'F8', price_list_name: 'Bảng giá chung', unit_price: 217350 },
        { product_code: 'F8-TAC', price_list_name: 'Bảng giá chung', unit_price: 17388 },
      ],
    })

    const [price] = await repository.resolvePrices?.({
      organizationId: 'org-dev-memory',
      productIds: ['product-f8'],
      customerId: null,
    }) ?? []

    expect(price).toEqual(expect.objectContaining({
      product_id: 'product-f8',
      unit_price: 217350,
      unit_prices_by_source_code: {
        'F8-TAC': 17388,
      },
    }))
  })

  it('matches KiotViet unit-conversion source codes to the parent product in dev memory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qcvl-dev-memory-'))
    const stateFile = join(dir, 'state.json')

    try {
      const repository = await createDevMemoryRepository({ stateFile })
      await repository.upsertSuppliersByCode?.({
        organizationId: 'org-dev-memory',
        rows: [{
          rowNumber: 2,
          code: 'NCC000001',
          name: 'NCC test',
          phone: null,
          email: null,
          address: null,
          area_name: null,
          ward_name: null,
          tax_code: null,
          note: null,
          company_name: null,
          source_creator_name: null,
          source_created_at: null,
          status: 'active',
          kiotviet_current_payable: null,
          kiotviet_total_purchase: null,
          kiotviet_net_purchase: null,
        }],
      })
      await repository.upsertProductsByCode?.({
        organizationId: 'org-dev-memory',
        rows: [{
          rowNumber: 2,
          code: 'BT',
          name: 'Bat 300g Ojet Tim',
          product_group_name: 'Bat',
          product_group_id: null,
          product_kind: 'roll',
          inventory_shape: 'roll',
          sell_method: 'area_m2',
          track_inventory: true,
          unit_name: 'm2',
          latest_purchase_cost: 20000,
          status: 'active',
          unit_conversions: [{
            source_code: 'B260',
            unit_name: 'Kho 260',
            stock_qty_per_unit: 208,
            is_default_purchase_unit: true,
            is_default_sale_unit: false,
          }],
          sale_price: null,
          provisional_stock: null,
          bom_text: null,
          source_created_at: null,
          ignored: {
            brand: null,
            min_stock: null,
            max_stock: null,
            direct_sale: null,
            location: null,
          },
        }],
      })

      const matchedCodes = await repository.findProductsByCodes?.({
        organizationId: 'org-dev-memory',
        codes: ['B260'],
      })
      const upsert = await repository.upsertImportedKiotVietPurchaseReceipts?.({
        organizationId: 'org-dev-memory',
        rows: [{
          rowNumber: 2,
          source_code: 'PN-B260',
          received_at: '2026-07-12T00:00:00.000Z',
          source_created_at: null,
          updated_at: null,
          supplier_code: 'NCC000001',
          supplier_name: 'NCC test',
          supplier_phone: null,
          supplier_address: null,
          received_by_name: null,
          source_creator_name: null,
          subtotal_amount: 1000,
          receipt_discount_amount: 0,
          payable_amount: 1000,
          paid_amount: 1000,
          note: null,
          supplier_document_no: null,
          total_quantity: 1,
          total_item_count: 1,
          status: 'posted',
          product_code: 'B260',
          product_name: 'Bat 300g Ojet Tim',
          brand_name: null,
          unit_name: 'Kho 260',
          product_note: null,
          list_unit_cost: null,
          line_discount_percent: null,
          line_discount_amount: 0,
          unit_cost: 1000,
          line_amount: 1000,
          quantity: 1,
        }],
      })
      const receipt = await repository.getPurchaseReceipt?.({
        organizationId: 'org-dev-memory',
        id: 'PN-B260',
      })
      const movements = await repository.listStockMovements?.({
        organizationId: 'org-dev-memory',
        url: new URL('http://api.local/api/v1/inventory/stock-movements?product_id=product-bt'),
      })

      await repository.upsertImportedKiotVietPurchaseReceipts?.({
        organizationId: 'org-dev-memory',
        rows: [{
          rowNumber: 2,
          source_code: 'PN-B260',
          received_at: '2026-07-12T00:00:00.000Z',
          source_created_at: null,
          updated_at: null,
          supplier_code: 'NCC000001',
          supplier_name: 'NCC test',
          supplier_phone: null,
          supplier_address: null,
          received_by_name: null,
          source_creator_name: null,
          subtotal_amount: 2000,
          receipt_discount_amount: 0,
          payable_amount: 2000,
          paid_amount: 2000,
          note: null,
          supplier_document_no: null,
          total_quantity: 2,
          total_item_count: 1,
          status: 'posted',
          product_code: 'B260',
          product_name: 'Bat 300g Ojet Tim',
          brand_name: null,
          unit_name: 'Kho 260',
          product_note: null,
          list_unit_cost: null,
          line_discount_percent: null,
          line_discount_amount: 0,
          unit_cost: 1000,
          line_amount: 2000,
          quantity: 2,
        }],
      })
      const movementsAfterReimport = await repository.listStockMovements?.({
        organizationId: 'org-dev-memory',
        url: new URL('http://api.local/api/v1/inventory/stock-movements?product_id=product-bt'),
      })

      await repository.deleteImportedKiotVietPurchaseReceipts?.({ organizationId: 'org-dev-memory' })
      const movementsAfterDelete = await repository.listStockMovements?.({
        organizationId: 'org-dev-memory',
        url: new URL('http://api.local/api/v1/inventory/stock-movements?product_id=product-bt'),
      })

      expect(matchedCodes).toEqual(new Set(['B260']))
      expect(upsert).toMatchObject({ receipts_created: 1, items_created: 1, skipped_rows: 0 })
      expect(receipt?.items[0]?.product).toMatchObject({ code: 'BT', name: 'Bat 300g Ojet Tim' })
      expect(movements).toEqual([
        expect.objectContaining({
          product_id: 'product-bt',
          movement_type: 'purchase_receipt',
          quantity_delta: 208,
          document_code: 'PN-B260',
          document_type: 'purchase_receipt',
          transaction_price: 1000,
          cost_price: 1000,
          ending_qty: 208,
          partner_name: 'NCC test',
        }),
      ])
      expect(movementsAfterReimport).toHaveLength(1)
      expect(movementsAfterReimport?.[0]).toMatchObject({ quantity_delta: 416, ending_qty: 416 })
      expect(movementsAfterDelete).toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('imports KiotViet invoices as sales documents and sale deduction movements', async () => {
    const repository = await createDevMemoryRepository()
    await repository.upsertCustomersByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'khachle',
        name: 'Khách lẻ',
        phone: null,
        email: null,
        address: null,
        area_name: null,
        ward_name: null,
        tax_code: null,
        customer_group_name: null,
        customer_group_id: null,
        note: null,
        customer_type: 'individual',
        company_name: null,
        source_creator_name: null,
        source_created_at: null,
        last_transaction_at: null,
        kiotviet_current_debt: null,
        kiotviet_total_sales: null,
        kiotviet_net_sales: null,
        status: 'active',
      }],
    })
    await repository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'BT',
        name: 'Bat 300g Ojet Tim',
        product_group_name: 'Bat',
        product_group_id: null,
        product_kind: 'roll',
        inventory_shape: 'roll',
        sell_method: 'area_m2',
        track_inventory: true,
        unit_name: 'm2',
        latest_purchase_cost: 20000,
        status: 'active',
        unit_conversions: [{
          source_code: 'B260',
          unit_name: 'Kho 260',
          stock_qty_per_unit: 208,
          is_default_purchase_unit: true,
          is_default_sale_unit: false,
        }],
        sale_price: null,
        provisional_stock: null,
        bom_text: null,
        source_created_at: null,
        ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null },
      }],
    })
    await repository.upsertSuppliersByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'NCC000001',
        name: 'NCC test',
        phone: null,
        email: null,
        address: null,
        area_name: null,
        ward_name: null,
        tax_code: null,
        note: null,
        company_name: null,
        source_creator_name: null,
        source_created_at: null,
        status: 'active',
        kiotviet_current_payable: null,
        kiotviet_total_purchase: null,
        kiotviet_net_purchase: null,
      }],
    })
    await repository.upsertImportedKiotVietPurchaseReceipts?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        source_code: 'PN-B260',
        received_at: '2026-07-12T00:00:00.000Z',
        source_created_at: null,
        updated_at: null,
        supplier_code: 'NCC000001',
        supplier_name: 'NCC test',
        supplier_phone: null,
        supplier_address: null,
        received_by_name: null,
        source_creator_name: null,
        subtotal_amount: 1000,
        receipt_discount_amount: 0,
        payable_amount: 1000,
        paid_amount: 1000,
        note: null,
        supplier_document_no: null,
        total_quantity: 1,
        total_item_count: 1,
        status: 'posted',
        product_code: 'B260',
        product_name: 'Bat 300g Ojet Tim',
        brand_name: null,
        unit_name: 'Kho 260',
        product_note: null,
        list_unit_cost: null,
        line_discount_percent: null,
        line_discount_amount: 0,
        unit_cost: 1000,
        line_amount: 1000,
        quantity: 1,
      }],
    })

    const upsert = await repository.upsertImportedKiotVietInvoices?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        source_code: 'HD-SALE',
        created_at: '2026-07-13T00:00:00.000Z',
        updated_at: null,
        customer_code: 'khachle',
        customer_name: 'Khách lẻ',
        customer_phone: null,
        customer_address: null,
        price_list_name: 'Bảng giá chung',
        source_user_name: 'Admin',
        channel_name: null,
        note: 'Ban B260',
        subtotal_amount: 500000,
        invoice_discount_amount: 0,
        other_income_amount: 0,
        total_amount: 500000,
        paid_amount: 300000,
        cash_amount: 100000,
        bank_amount: 200000,
        status: 'completed',
        product_code: 'B260',
        product_name: 'Bat 300g Ojet Tim',
        unit_name: 'Kho 260',
        product_note: null,
        quantity: 0.5,
        list_unit_price: 500000,
        line_discount_percent: null,
        line_discount_amount: 0,
        unit_price: 500000,
        line_amount: 250000,
      }],
    })
    const documents = await repository.listSalesDocuments?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/sales-documents?search=HD-SALE'),
    })
    const movements = await repository.listStockMovements?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/inventory/stock-movements?product_id=product-bt'),
    })

    expect(upsert).toMatchObject({ invoices_created: 1, items_created: 1, skipped_rows: 0 })
    expect(documents).toEqual([
      expect.objectContaining({
        code: 'HD-SALE',
        order_type: 'invoice',
        customer: expect.objectContaining({ code: 'khachle' }),
        paid_amount: 300000,
        debt_amount: 200000,
      }),
    ])
    expect(movements).toEqual([
      expect.objectContaining({ movement_type: 'purchase_receipt', quantity_delta: 208, ending_qty: 208 }),
      expect.objectContaining({
        movement_type: 'sale_deduction',
        quantity_delta: -104,
        document_code: 'HD-SALE',
        document_type: 'sale_invoice',
        ending_qty: 104,
        partner_name: 'Khách lẻ',
      }),
    ])
  })

  it('exposes product operating stock from imported stock movements', async () => {
    const repository = await createDevMemoryRepository()
    await repository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'BT',
        name: 'Bat 300g Ojet Tim',
        product_group_name: 'Bat',
        product_group_id: null,
        product_kind: 'roll',
        inventory_shape: 'roll',
        sell_method: 'area_m2',
        track_inventory: true,
        unit_name: 'm2',
        latest_purchase_cost: 20000,
        status: 'active',
        unit_conversions: [{
          source_code: 'B260',
          unit_name: 'Kho 260',
          stock_qty_per_unit: 208,
          is_default_purchase_unit: true,
          is_default_sale_unit: false,
        }],
        sale_price: null,
        provisional_stock: null,
        bom_text: null,
        source_created_at: null,
        ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null },
      }],
    })
    await repository.upsertSuppliersByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'NCC000001',
        name: 'NCC test',
        phone: null,
        email: null,
        address: null,
        area_name: null,
        ward_name: null,
        tax_code: null,
        note: null,
        company_name: null,
        source_creator_name: null,
        source_created_at: null,
        status: 'active',
        kiotviet_current_payable: null,
        kiotviet_total_purchase: null,
        kiotviet_net_purchase: null,
      }],
    })
    await repository.upsertCustomersByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'khachle',
        name: 'Khach le',
        phone: null,
        email: null,
        address: null,
        area_name: null,
        ward_name: null,
        tax_code: null,
        customer_group_name: null,
        customer_group_id: null,
        note: null,
        customer_type: 'individual',
        company_name: null,
        source_creator_name: null,
        source_created_at: null,
        last_transaction_at: null,
        kiotviet_current_debt: null,
        kiotviet_total_sales: null,
        kiotviet_net_sales: null,
        status: 'active',
      }],
    })
    await repository.upsertImportedKiotVietPurchaseReceipts?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        source_code: 'PN-B260',
        received_at: '2026-07-12T00:00:00.000Z',
        source_created_at: null,
        updated_at: null,
        supplier_code: 'NCC000001',
        supplier_name: 'NCC test',
        supplier_phone: null,
        supplier_address: null,
        received_by_name: null,
        source_creator_name: null,
        subtotal_amount: 1000,
        receipt_discount_amount: 0,
        payable_amount: 1000,
        paid_amount: 1000,
        note: null,
        supplier_document_no: null,
        total_quantity: 1,
        total_item_count: 1,
        status: 'posted',
        product_code: 'B260',
        product_name: 'Bat 300g Ojet Tim',
        brand_name: null,
        unit_name: 'Kho 260',
        product_note: null,
        list_unit_cost: null,
        line_discount_percent: null,
        line_discount_amount: 0,
        unit_cost: 1000,
        line_amount: 1000,
        quantity: 1,
      }],
    })
    await repository.upsertImportedKiotVietInvoices?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        source_code: 'HD-SALE',
        created_at: '2026-07-13T00:00:00.000Z',
        updated_at: null,
        customer_code: 'khachle',
        customer_name: 'Khach le',
        customer_phone: null,
        customer_address: null,
        price_list_name: null,
        source_user_name: null,
        channel_name: null,
        note: null,
        subtotal_amount: 500000,
        invoice_discount_amount: 0,
        other_income_amount: 0,
        total_amount: 500000,
        paid_amount: 500000,
        cash_amount: 500000,
        bank_amount: 0,
        status: 'completed',
        product_code: 'B260',
        product_name: 'Bat 300g Ojet Tim',
        unit_name: 'Kho 260',
        product_note: null,
        quantity: 0.25,
        list_unit_price: null,
        line_discount_percent: null,
        line_discount_amount: 0,
        unit_price: 500000,
        line_amount: 125000,
      }],
    })

    const products = await repository.listProducts?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/products?search=BT'),
    })

    expect(products?.[0]).toMatchObject({
      code: 'BT',
      operating_stock: {
        quantity: 156,
        unit_name: 'm2',
        source_type: 'stock_movements',
        source_label: 'Nhap hang - hoa don',
      },
    })
  })

  it('deducts combo BOM components from imported sales invoices', async () => {
    const repository = await createDevMemoryRepository()
    await repository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [
        {
          rowNumber: 2,
          code: 'BT',
          name: 'Bat 300g Ojet Tim',
          product_group_name: 'Bat',
          product_group_id: null,
          product_kind: 'roll',
          inventory_shape: 'roll',
          sell_method: 'area_m2',
          track_inventory: true,
          unit_name: 'm2',
          latest_purchase_cost: 9844.39,
          status: 'active',
          unit_conversions: [],
          sale_price: null,
          provisional_stock: null,
          bom_text: null,
          source_created_at: null,
          ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null },
        },
        {
          rowNumber: 3,
          code: 'IB',
          name: 'In bat',
          product_group_name: 'Dich vu',
          product_group_id: null,
          product_kind: 'combo',
          inventory_shape: 'normal',
          sell_method: 'combo',
          track_inventory: false,
          unit_name: 'm2',
          latest_purchase_cost: null,
          status: 'active',
          unit_conversions: [],
          sale_price: null,
          provisional_stock: null,
          bom_text: 'BT:1.2',
          source_created_at: null,
          ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null },
        },
      ],
    })
    await repository.upsertDraftProductBoms?.({
      organizationId: 'org-dev-memory',
      rows: [{
        product_code: 'IB',
        source_text: 'BT:1.2',
        components: [{ component_code: 'BT', quantity: 1.2 }],
        note: 'Imported from KiotViet product BOM. Trusted for stock deduction.',
      }],
    })
    await repository.upsertCustomersByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'khachle',
        name: 'Khach le',
        customer_type: 'individual',
        company_name: null,
        phone: null,
        tax_code: null,
        address: null,
        area_name: null,
        ward_name: null,
        customer_group_name: null,
        customer_group_id: null,
        note: null,
        source_creator_name: null,
        source_created_at: null,
        last_transaction_at: null,
        status: 'active',
        kiotviet_current_debt: null,
        kiotviet_total_sales: null,
        kiotviet_net_sales: null,
      }],
    })

    await repository.upsertImportedKiotVietInvoices?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        source_code: 'HD-COMBO',
        created_at: '2026-07-13T00:00:00.000Z',
        updated_at: null,
        customer_code: 'khachle',
        customer_name: 'Khach le',
        customer_phone: null,
        customer_address: null,
        price_list_name: null,
        source_user_name: null,
        channel_name: null,
        note: 'Ban combo IB',
        subtotal_amount: 650000,
        invoice_discount_amount: 0,
        other_income_amount: 0,
        total_amount: 650000,
        paid_amount: 650000,
        cash_amount: 650000,
        bank_amount: 0,
        status: 'completed',
        product_code: 'IB',
        product_name: 'In bat',
        unit_name: 'm2',
        product_note: null,
        quantity: 10,
        list_unit_price: 65000,
        line_discount_percent: null,
        line_discount_amount: 0,
        unit_price: 65000,
        line_amount: 650000,
      }],
    })

    const movements = await repository.listStockMovements?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/inventory/stock-movements?product_id=product-bt'),
    })

    expect(movements).toEqual([
      expect.objectContaining({
        product_id: 'product-bt',
        movement_type: 'sale_deduction',
        quantity_delta: -12,
        document_code: 'HD-COMBO',
        document_type: 'sale_invoice',
        transaction_price: null,
        cost_price: 9844.39,
        ending_qty: -12,
      }),
    ])
  })

  it('deducts trusted KiotViet BOM components from POS invoices', async () => {
    const repository = await createDevMemoryRepository()
    await repository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [
        {
          rowNumber: 2,
          code: 'BT',
          name: 'Bat 300g Ojet Tim',
          product_group_name: 'Bat',
          product_group_id: null,
          product_kind: 'roll',
          inventory_shape: 'roll',
          sell_method: 'area_m2',
          track_inventory: true,
          unit_name: 'm2',
          latest_purchase_cost: 9844.39,
          status: 'active',
          unit_conversions: [],
          sale_price: null,
          provisional_stock: null,
          bom_text: null,
          source_created_at: null,
          ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null },
        },
        {
          rowNumber: 3,
          code: 'IB',
          name: 'In bat',
          product_group_name: 'Dich vu',
          product_group_id: null,
          product_kind: 'combo',
          inventory_shape: 'normal',
          sell_method: 'combo',
          track_inventory: false,
          unit_name: 'm2',
          latest_purchase_cost: null,
          status: 'active',
          unit_conversions: [],
          sale_price: null,
          provisional_stock: null,
          bom_text: 'BT:1.2',
          source_created_at: null,
          ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null },
        },
      ],
    })
    await repository.upsertDraftProductBoms?.({
      organizationId: 'org-dev-memory',
      rows: [{
        product_code: 'IB',
        source_text: 'BT:1.2',
        components: [{ component_code: 'BT', quantity: 1.2 }],
        note: 'Imported from KiotViet product BOM. Trusted for stock deduction.',
      }],
    })

    await repository.saveSalesDocument?.({
      organizationId: 'org-dev-memory',
      document: {
        id: 'order-pos-combo',
        code: 'HD-POS-COMBO',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-13T09:00:00.000Z',
        customer: { id: 'customer-retail', code: 'khachle', name: 'Khach le', phone: null },
        seller: { id: 'admin', name: 'Admin' },
        subtotal_amount: 650000,
        discount_amount: 0,
        total_amount: 650000,
        paid_amount: 650000,
        debt_amount: 0,
        payment_status: 'paid',
        note: null,
        items: [{ product_id: 'product-ib', quantity: 10, unit_price: 65000 }],
      },
      cashbookEntries: [],
    })

    const movements = await repository.listStockMovements?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/inventory/stock-movements?product_id=product-bt'),
    })

    expect(movements).toEqual([
      expect.objectContaining({
        product_id: 'product-bt',
        movement_type: 'sale_deduction',
        quantity_delta: -12,
        document_code: 'HD-POS-COMBO',
      }),
    ])
  })

  it('deducts POS invoices by selected sale unit conversion', async () => {
    const repository = await createDevMemoryRepository()
    await repository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'F5',
        name: 'Fomex 5mm',
        product_group_name: 'Fomex',
        product_group_id: null,
        product_kind: 'goods',
        inventory_shape: 'normal',
        sell_method: 'quantity',
        track_inventory: true,
        unit_name: 'Tấm',
        latest_purchase_cost: 120000,
        status: 'active',
        unit_conversions: [
          {
            unit_id: 'unit-tac',
            unit_name: 'Tấc',
            stock_qty_per_unit: 0.05,
            is_default_purchase_unit: false,
            is_default_sale_unit: false,
          },
        ],
        sale_price: null,
        provisional_stock: null,
        bom_text: null,
        source_created_at: null,
        ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null },
      }],
    })

    await repository.saveSalesDocument?.({
      organizationId: 'org-dev-memory',
      document: {
        id: 'order-pos-unit',
        code: 'HD-POS-UNIT',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-13T09:00:00.000Z',
        customer: { id: 'customer-retail', code: 'khachle', name: 'Khach le', phone: null },
        seller: { id: 'admin', name: 'Admin' },
        subtotal_amount: 30000,
        discount_amount: 0,
        total_amount: 30000,
        paid_amount: 30000,
        debt_amount: 0,
        payment_status: 'paid',
        note: null,
        items: [{
          product_id: 'product-f5',
          quantity: 1,
          unit_price: 30000,
          sale_unit_name: 'Tấc',
          stock_qty_per_sale_unit: 0.05,
        }],
      },
      cashbookEntries: [],
    })

    const movements = await repository.listStockMovements?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/inventory/stock-movements?product_id=product-f5'),
    })

    expect(movements).toEqual([
      expect.objectContaining({
        product_id: 'product-f5',
        movement_type: 'sale_deduction',
        quantity_delta: -0.05,
        document_code: 'HD-POS-UNIT',
      }),
    ])
  })

  it('replaces imported invoice items by invoice code instead of keeping stale row numbers', async () => {
    const repository = await createDevMemoryRepository()
    await repository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'BT',
        name: 'Bat 300g Ojet Tim',
        product_group_name: 'Bat',
        product_group_id: null,
        product_kind: 'roll',
        inventory_shape: 'roll',
        sell_method: 'area_m2',
        track_inventory: true,
        unit_name: 'm2',
        latest_purchase_cost: 9844.39,
        status: 'active',
        unit_conversions: [],
        sale_price: null,
        provisional_stock: null,
        bom_text: null,
        source_created_at: null,
        ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null },
      }],
    })
    await repository.upsertCustomersByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'khachle',
        name: 'Khach le',
        customer_type: 'individual',
        company_name: null,
        phone: null,
        tax_code: null,
        address: null,
        area_name: null,
        ward_name: null,
        customer_group_name: null,
        customer_group_id: null,
        note: null,
        source_creator_name: null,
        source_created_at: null,
        last_transaction_at: null,
        status: 'active',
        kiotviet_current_debt: null,
        kiotviet_total_sales: null,
        kiotviet_net_sales: null,
      }],
    })
    const baseRow = {
      source_code: 'HD-REIMPORT',
      created_at: '2026-07-13T00:00:00.000Z',
      updated_at: null,
      customer_code: 'khachle',
      customer_name: 'Khach le',
      customer_phone: null,
      customer_address: null,
      price_list_name: null,
      source_user_name: null,
      channel_name: null,
      note: null,
      subtotal_amount: 100000,
      invoice_discount_amount: 0,
      other_income_amount: 0,
      total_amount: 100000,
      paid_amount: 100000,
      cash_amount: 100000,
      bank_amount: 0,
      status: 'completed' as const,
      product_code: 'BT',
      product_name: 'Bat 300g Ojet Tim',
      unit_name: 'm2',
      product_note: null,
      list_unit_price: null,
      line_discount_percent: null,
      line_discount_amount: 0,
      unit_price: 10000,
      line_amount: 100000,
    }

    await repository.upsertImportedKiotVietInvoices?.({
      organizationId: 'org-dev-memory',
      rows: [{ ...baseRow, rowNumber: 10, quantity: 5 }],
    })
    const upsert = await repository.upsertImportedKiotVietInvoices?.({
      organizationId: 'org-dev-memory',
      rows: [{ ...baseRow, rowNumber: 99, quantity: 2 }],
    })

    const movements = await repository.listStockMovements?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/inventory/stock-movements?product_id=product-bt'),
    })

    expect(upsert).toMatchObject({ invoices_created: 0, invoices_updated: 1, items_created: 0, items_updated: 1 })
    expect(movements).toEqual([
      expect.objectContaining({
        document_code: 'HD-REIMPORT',
        quantity_delta: -2,
        ending_qty: -2,
      }),
    ])
  })

  it('uses balanced stocktakes as stock checkpoints before later document movements', async () => {
    const repository = await createDevMemoryRepository()
    await repository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [
        {
          rowNumber: 2,
          code: 'BT',
          name: 'Bat 300g Ojet Tim',
          product_group_name: 'Bat',
          product_group_id: null,
          product_kind: 'roll',
          inventory_shape: 'roll',
          sell_method: 'area_m2',
          track_inventory: true,
          unit_name: 'm2',
          latest_purchase_cost: 9844.39,
          status: 'active',
          unit_conversions: [],
          sale_price: null,
          provisional_stock: null,
          bom_text: null,
          source_created_at: null,
          ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null },
        },
        {
          rowNumber: 3,
          code: 'IB',
          name: 'In bat',
          product_group_name: 'Dich vu',
          product_group_id: null,
          product_kind: 'combo',
          inventory_shape: 'normal',
          sell_method: 'combo',
          track_inventory: false,
          unit_name: 'm2',
          latest_purchase_cost: null,
          status: 'active',
          unit_conversions: [],
          sale_price: null,
          provisional_stock: null,
          bom_text: 'BT:1.2',
          source_created_at: null,
          ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null },
        },
      ],
    })
    await repository.upsertDraftProductBoms?.({
      organizationId: 'org-dev-memory',
      rows: [{
        product_code: 'IB',
        source_text: 'BT:1.2',
        components: [{ component_code: 'BT', quantity: 1.2 }],
        note: 'Imported from KiotViet product BOM. Trusted for stock deduction.',
      }],
    })
    await repository.upsertCustomersByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'khachle',
        name: 'Khach le',
        customer_type: 'individual',
        company_name: null,
        phone: null,
        tax_code: null,
        address: null,
        area_name: null,
        ward_name: null,
        customer_group_name: null,
        customer_group_id: null,
        note: null,
        source_creator_name: null,
        source_created_at: null,
        last_transaction_at: null,
        status: 'active',
        kiotviet_current_debt: null,
        kiotviet_total_sales: null,
        kiotviet_net_sales: null,
      }],
    })
    await repository.upsertImportedKiotVietStocktakes?.({
      organizationId: 'org-dev-memory',
      createdBy: null,
      rows: [{
        rowNumber: 2,
        source_code: 'KK-CHECKPOINT',
        source_created_at: '2026-05-28T22:48:04.273Z',
        source_creator_name: null,
        source_balanced_at: '2026-05-28T22:48:04.270Z',
        status: 'balanced',
        product_code: 'BT',
        product_name: 'Bat 300g Ojet Tim',
        unit_name: 'm2',
        system_qty: 9660.851,
        actual_qty: 2500,
        difference_qty: -7160.851,
        increased_qty: 0,
        decreased_qty: -7160.851,
        total_actual_value: null,
        total_difference_value: null,
        line_difference_value: null,
        note: 'Checkpoint',
        is_deleted_product_code: false,
        formula_valid: true,
      }],
    })
    await repository.upsertImportedKiotVietInvoices?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        source_code: 'HD-AFTER-CHECKPOINT',
        created_at: '2026-07-13T00:00:00.000Z',
        updated_at: null,
        customer_code: 'khachle',
        customer_name: 'Khach le',
        customer_phone: null,
        customer_address: null,
        price_list_name: null,
        source_user_name: null,
        channel_name: null,
        note: 'Ban combo IB',
        subtotal_amount: 650000,
        invoice_discount_amount: 0,
        other_income_amount: 0,
        total_amount: 650000,
        paid_amount: 650000,
        cash_amount: 650000,
        bank_amount: 0,
        status: 'completed',
        product_code: 'IB',
        product_name: 'In bat',
        unit_name: 'm2',
        product_note: null,
        quantity: 10,
        list_unit_price: 65000,
        line_discount_percent: null,
        line_discount_amount: 0,
        unit_price: 65000,
        line_amount: 650000,
      }],
    })

    const movements = await repository.listStockMovements?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/inventory/stock-movements?product_id=product-bt'),
    })

    expect(movements).toEqual([
      expect.objectContaining({
        movement_type: 'stocktake_balance',
        quantity_delta: 2500,
        ending_qty: 2500,
        document_code: 'KK-CHECKPOINT',
      }),
      expect.objectContaining({
        movement_type: 'sale_deduction',
        quantity_delta: -12,
        ending_qty: 2488,
        document_code: 'HD-AFTER-CHECKPOINT',
      }),
    ])
  })

  it('does not map deleted KiotViet stocktake codes to active base products', async () => {
    const repository = await createDevMemoryRepository()
    await repository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        code: 'SP000111',
        name: 'Ao Poly 4 chieu',
        status: 'active',
        product_group_id: null,
        unit_name: 'Cai',
        sell_method: 'quantity',
        product_kind: 'goods',
        inventory_shape: 'normal',
        track_inventory: true,
        latest_purchase_cost: 56740,
        unit_conversions: [],
        source_created_at: null,
        source: {
          rowNumber: 2,
          code: 'SP000111',
          name: 'Ao Poly 4 chieu',
          product_group_name: 'Vat lieu',
          product_kind: 'goods',
          inventory_shape: 'normal',
          sell_method: 'quantity',
          track_inventory: true,
          unit_name: 'Cai',
          unit_name_needs_review: false,
          latest_purchase_cost: 56740,
          status: 'active',
          unit_conversions: [],
          sale_price: null,
          provisional_stock: null,
          bom_text: null,
          expected_out_of_stock_text: null,
          source_created_at: null,
          ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null },
        },
      }],
    })
    await repository.upsertImportedKiotVietStocktakes?.({
      organizationId: 'org-dev-memory',
      createdBy: null,
      rows: [
        {
          rowNumber: 2,
          source_code: 'XNT-CHECKPOINT',
          source_created_at: '2026-07-12T16:00:00.000Z',
          source_creator_name: 'KiotViet XNT',
          source_balanced_at: '2026-07-12T16:00:00.000Z',
          status: 'balanced',
          product_code: 'SP000111',
          product_name: 'Ao Poly 4 chieu',
          unit_name: 'Cai',
          system_qty: null,
          actual_qty: 25,
          difference_qty: null,
          increased_qty: null,
          decreased_qty: null,
          total_actual_value: null,
          total_difference_value: null,
          line_difference_value: null,
          note: 'Active current code',
          is_deleted_product_code: false,
          formula_valid: true,
        },
        {
          rowNumber: 3,
          source_code: 'XNT-CHECKPOINT',
          source_created_at: '2026-07-12T16:00:00.000Z',
          source_creator_name: 'KiotViet XNT',
          source_balanced_at: '2026-07-12T16:00:00.000Z',
          status: 'balanced',
          product_code: 'SP000111{DEL}',
          product_name: 'Ao poly thai 4 chieu 3 soc',
          unit_name: 'cai',
          system_qty: null,
          actual_qty: 0,
          difference_qty: null,
          increased_qty: null,
          decreased_qty: null,
          total_actual_value: null,
          total_difference_value: null,
          line_difference_value: null,
          note: 'Deleted history code',
          is_deleted_product_code: true,
          formula_valid: true,
        },
      ],
    })

    const products = await repository.listProducts?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/products?status=all'),
    })

    expect(products?.find((product) => product.code === 'SP000111')?.operating_stock?.quantity).toBe(25)
  })

  it('subtracts stock for POS invoices saved through saveSalesDocument', async () => {
    const repository = await createDevMemoryRepository()
    await repository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        code: 'POS-STOCK',
        name: 'POS stock product',
        status: 'active',
        product_group_id: null,
        unit_name: 'Cai',
        sell_method: 'quantity',
        product_kind: 'goods',
        inventory_shape: 'normal',
        track_inventory: true,
        latest_purchase_cost: 10000,
        unit_conversions: [],
        source_created_at: null,
        source: {
          rowNumber: 2,
          code: 'POS-STOCK',
          name: 'POS stock product',
          product_group_name: 'Vat lieu',
          product_kind: 'goods',
          inventory_shape: 'normal',
          sell_method: 'quantity',
          track_inventory: true,
          unit_name: 'Cai',
          unit_name_needs_review: false,
          latest_purchase_cost: 10000,
          status: 'active',
          unit_conversions: [],
          sale_price: null,
          provisional_stock: null,
          bom_text: null,
          expected_out_of_stock_text: null,
          source_created_at: null,
          ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null },
        },
      }],
    })
    await repository.upsertImportedKiotVietStocktakes?.({
      organizationId: 'org-dev-memory',
      createdBy: null,
      rows: [{
        rowNumber: 2,
        source_code: 'XNT-POS',
        source_created_at: '2026-07-12T16:00:00.000Z',
        source_creator_name: 'KiotViet XNT',
        source_balanced_at: '2026-07-12T16:00:00.000Z',
        status: 'balanced',
        product_code: 'POS-STOCK',
        product_name: 'POS stock product',
        unit_name: 'Cai',
        system_qty: null,
        actual_qty: 10,
        difference_qty: null,
        increased_qty: null,
        decreased_qty: null,
        total_actual_value: null,
        total_difference_value: null,
        line_difference_value: null,
        note: 'Checkpoint',
        is_deleted_product_code: false,
        formula_valid: true,
      }],
    })

    await repository.saveSalesDocument?.({
      organizationId: 'org-dev-memory',
      document: {
        id: 'order-pos-stock',
        code: 'HD-POS-STOCK',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-13T09:00:00.000Z',
        customer: { id: 'customer-retail', code: 'khachle', name: 'Khach le', phone: null },
        seller: { id: 'admin', name: 'Admin' },
        subtotal_amount: 100000,
        discount_amount: 0,
        total_amount: 100000,
        paid_amount: 100000,
        debt_amount: 0,
        payment_status: 'paid',
        note: null,
        items: [{ product_id: 'product-pos-stock', quantity: 2, unit_price: 50000 }],
      },
      cashbookEntries: [],
    })

    const products = await repository.listProducts?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/products?status=all'),
    })

    expect(products?.find((product) => product.code === 'POS-STOCK')?.operating_stock?.quantity).toBe(8)
  })

  it('keeps deleted KiotViet invoice references as inactive history without stock deduction', async () => {
    const repository = await createDevMemoryRepository()
    await repository.upsertCustomersByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'KH000166{DEL}',
        name: 'Khach da xoa',
        phone: null,
        email: null,
        address: null,
        area_name: null,
        ward_name: null,
        tax_code: null,
        customer_group_name: null,
        customer_group_id: null,
        note: null,
        customer_type: 'individual',
        company_name: null,
        source_creator_name: null,
        source_created_at: null,
        last_transaction_at: null,
        kiotviet_current_debt: null,
        kiotviet_total_sales: null,
        kiotviet_net_sales: null,
        status: 'inactive',
      }],
    })
    await repository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'SP000299{DEL}',
        name: 'Hang da xoa',
        product_group_name: '',
        product_group_id: null,
        product_kind: 'goods',
        inventory_shape: 'normal',
        sell_method: 'quantity',
        track_inventory: false,
        unit_name: 'cai',
        latest_purchase_cost: null,
        status: 'inactive',
        unit_conversions: [],
        sale_price: null,
        provisional_stock: null,
        bom_text: null,
        source_created_at: null,
        ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null },
      }],
    })

    const upsert = await repository.upsertImportedKiotVietInvoices?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        source_code: 'HD-DEL',
        created_at: '2026-07-13T00:00:00.000Z',
        updated_at: null,
        customer_code: 'KH000166{DEL}',
        customer_name: 'Khach da xoa',
        customer_phone: null,
        customer_address: null,
        price_list_name: null,
        source_user_name: null,
        channel_name: null,
        note: null,
        subtotal_amount: 1000,
        invoice_discount_amount: 0,
        other_income_amount: 0,
        total_amount: 1000,
        paid_amount: 1000,
        cash_amount: 1000,
        bank_amount: 0,
        status: 'completed',
        product_code: 'SP000299{DEL}',
        product_name: 'Hang da xoa',
        unit_name: 'cai',
        product_note: null,
        quantity: 1,
        list_unit_price: null,
        line_discount_percent: null,
        line_discount_amount: 0,
        unit_price: 1000,
        line_amount: 1000,
      }],
    })
    const documents = await repository.listSalesDocuments?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/sales-documents?search=HD-DEL'),
    })
    const movements = await repository.listStockMovements?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/inventory/stock-movements'),
    })

    expect(upsert).toMatchObject({ invoices_created: 1, items_created: 1, skipped_rows: 0 })
    expect(documents).toEqual([expect.objectContaining({ code: 'HD-DEL', customer: expect.objectContaining({ code: 'KH000166{DEL}' }) })])
    expect(movements).toEqual([])
  })

  it('keeps imported customers and resolves creator by username after repository restart', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qcvl-dev-memory-'))
    const stateFile = join(dir, 'state.json')

    try {
      const first = await createDevMemoryRepository({ stateFile })
      const user = await first.createUser?.({
        organizationId: 'org-dev-memory',
        email: 'maiphuong@example.test',
        username: 'maiphuong',
        phone: '0909000000',
        birthday: null,
        region: null,
        ward: null,
        address: null,
        note: null,
        passwordHash: 'hash',
        displayName: 'Mai Phuong',
        permissions: ['perm.create_order'],
      })
      const groupIds = await first.upsertCustomerGroupsByName?.({
        organizationId: 'org-dev-memory',
        names: ['Khach cong ty'],
      })
      await first.upsertCustomersByCode?.({
        organizationId: 'org-dev-memory',
        rows: [
          {
            rowNumber: 2,
            code: 'KH-PERSIST',
            name: 'Khach import that',
            customer_type: 'company',
            company_name: 'Cong ty Test',
            phone: '0908123456',
            tax_code: '0312345678',
            address: 'Dia chi test',
            area_name: 'TP.HCM',
            ward_name: 'Phuong 1',
            customer_group_name: 'Khach cong ty',
            customer_group_id: groupIds?.get('Khach cong ty') ?? null,
            note: 'Ghi chu import',
            source_creator_name: 'maiphuong{DEL}',
            source_created_at: '2026-07-11T00:00:00.000Z',
            last_transaction_at: null,
            status: 'active',
            kiotviet_current_debt: 150000,
            kiotviet_total_sales: 2500000,
            kiotviet_net_sales: 2300000,
          },
        ],
      })
      await first.close()

      const restarted = await createDevMemoryRepository({ stateFile })
      const customers = await (restarted as DevMemoryRepositoryWithHelpers).listCustomers({
        organizationId: 'org-dev-memory',
        url: new URL('http://api.local/api/v1/customers?search=KH-PERSIST'),
      })
      await restarted.close()

      expect(customers).toEqual([
        expect.objectContaining({
          code: 'KH-PERSIST',
          name: 'Khach import that',
          note: 'Ghi chu import',
          source_creator_name: 'maiphuong{DEL}',
          created_by: { id: user?.id, name: 'Mai Phuong' },
        }),
      ])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('keeps khachle when deleting old KiotViet customer import rows', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qcvl-dev-memory-'))
    const stateFile = join(dir, 'state.json')

    try {
      const repository = await createDevMemoryRepository({ stateFile })
      await repository.upsertCustomersByCode?.({
        organizationId: 'org-dev-memory',
        rows: [
          {
            rowNumber: 2,
            code: 'khachle',
            name: 'Khach le',
            customer_type: 'individual',
            company_name: null,
            phone: null,
            tax_code: null,
            address: null,
            area_name: null,
            ward_name: null,
            customer_group_name: null,
            customer_group_id: null,
            note: null,
            source_creator_name: null,
            source_created_at: null,
            last_transaction_at: null,
            status: 'active',
            kiotviet_current_debt: null,
            kiotviet_total_sales: null,
            kiotviet_net_sales: null,
          },
          {
            rowNumber: 3,
            code: 'KH-KV-OLD',
            name: 'Khach KV cu',
            customer_type: 'individual',
            company_name: null,
            phone: null,
            tax_code: null,
            address: null,
            area_name: null,
            ward_name: null,
            customer_group_name: null,
            customer_group_id: null,
            note: null,
            source_creator_name: null,
            source_created_at: null,
            last_transaction_at: null,
            status: 'active',
            kiotviet_current_debt: null,
            kiotviet_total_sales: null,
            kiotviet_net_sales: null,
          },
        ],
      })

      const result = await repository.deleteImportedKiotVietCustomers?.({ organizationId: 'org-dev-memory' })
      const customers = await (repository as DevMemoryRepositoryWithHelpers).listCustomers({
        organizationId: 'org-dev-memory',
        url: new URL('http://api.local/api/v1/customers?page=1&page_size=100'),
      })
      await repository.close()

      expect(result).toEqual({ deleted: 1, blocked: 0 })
      expect(customers).toEqual([
        expect.objectContaining({ code: 'khachle', name: 'Khach le' }),
      ])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('persists imported KiotViet suppliers across repository restarts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qcvl-dev-memory-'))
    const stateFile = join(dir, 'state.json')

    try {
      const first = await createDevMemoryRepository({ stateFile })
      await first.upsertSuppliersByCode?.({
        organizationId: 'org-dev-memory',
        rows: [
          {
            rowNumber: 2,
            code: 'THN',
            name: 'Thinh Hong Nguyen',
            phone: '0787583609',
            email: null,
            address: 'Trieu Ai, Trieu Phong',
            area_name: 'Trieu Phong',
            ward_name: 'Trieu Ai',
            tax_code: null,
            note: 'NCC import',
            company_name: null,
            source_creator_name: 'Van Lam',
            source_created_at: '2026-06-05T09:20:05.967Z',
            status: 'active',
            kiotviet_current_payable: 0,
            kiotviet_total_purchase: 31973289,
            kiotviet_net_purchase: 31973289,
          },
        ],
      })
      await first.close()

      const restarted = await createDevMemoryRepository({ stateFile })
      const suppliers = await restarted.listSuppliers?.({
        organizationId: 'org-dev-memory',
        url: new URL('http://api.local/api/v1/suppliers?q=thinh%20hong'),
      })
      await restarted.close()

      expect(suppliers).toEqual([
        expect.objectContaining({
          code: 'THN',
          name: 'Thinh Hong Nguyen',
          current_payable_amount: 0,
          total_purchase_amount: 31973289,
        }),
      ])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('links exact-matching customer and supplier imports and keeps the link after restart', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qcvl-dev-memory-'))
    const stateFile = join(dir, 'state.json')

    try {
      const first = await createDevMemoryRepository({ stateFile })
      await first.upsertCustomersByCode?.({
        organizationId: 'org-dev-memory',
        rows: [
          {
            rowNumber: 2,
            code: 'UT',
            name: 'Út Tèo',
            phone: null,
            email: null,
            address: 'Triệu Phong',
            area_name: null,
            ward_name: null,
            tax_code: null,
            customer_group_name: null,
            customer_group_id: null,
            note: null,
            customer_type: 'individual',
            company_name: null,
            source_creator_name: null,
            source_created_at: null,
            last_transaction_at: null,
            kiotviet_current_debt: null,
            kiotviet_total_sales: null,
            kiotviet_net_sales: null,
            status: 'active',
          },
        ],
      })
      await first.upsertSuppliersByCode?.({
        organizationId: 'org-dev-memory',
        rows: [
          {
            rowNumber: 2,
            code: 'NCC000035',
            name: 'Út Tèo',
            phone: null,
            email: null,
            address: 'Triệu Phong',
            area_name: null,
            ward_name: null,
            tax_code: null,
            note: null,
            company_name: null,
            source_creator_name: null,
            source_created_at: null,
            status: 'active',
            kiotviet_current_payable: null,
            kiotviet_total_purchase: null,
            kiotviet_net_purchase: null,
          },
        ],
      })
      const linkedCustomers = await first.listCustomers?.({
        organizationId: 'org-dev-memory',
        url: new URL('http://api.local/api/v1/customers?page=1&page_size=100'),
      })
      await first.close()

      const restarted = await createDevMemoryRepository({ stateFile })
      const restartedCustomers = await restarted.listCustomers?.({
        organizationId: 'org-dev-memory',
        url: new URL('http://api.local/api/v1/customers?page=1&page_size=100'),
      })
      await restarted.close()

      expect(linkedCustomers?.[0]).toEqual(expect.objectContaining({
        code: 'UT',
        linked_supplier: expect.objectContaining({
          code: 'NCC000035',
          name: 'Út Tèo',
        }),
      }))
      expect(restartedCustomers?.[0]).toEqual(expect.objectContaining({
        code: 'UT',
        linked_supplier: expect.objectContaining({
          code: 'NCC000035',
          name: 'Út Tèo',
        }),
      }))
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('deletes old imported KiotViet supplier rows', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qcvl-dev-memory-'))
    const stateFile = join(dir, 'state.json')

    try {
      const repository = await createDevMemoryRepository({ stateFile })
      await repository.upsertSuppliersByCode?.({
        organizationId: 'org-dev-memory',
        rows: [
          {
            rowNumber: 2,
            code: 'THN',
            name: 'Thinh Hong Nguyen',
            phone: null,
            email: null,
            address: null,
            area_name: null,
            ward_name: null,
            tax_code: null,
            note: null,
            company_name: null,
            source_creator_name: null,
            source_created_at: null,
            status: 'active',
            kiotviet_current_payable: null,
            kiotviet_total_purchase: null,
            kiotviet_net_purchase: null,
          },
        ],
      })

      const result = await repository.deleteImportedKiotVietSuppliers?.({ organizationId: 'org-dev-memory' })
      const suppliers = await repository.listSuppliers?.({
        organizationId: 'org-dev-memory',
        url: new URL('http://api.local/api/v1/suppliers?page=1&page_size=100'),
      })
      await repository.close()

      expect(result).toEqual({ deleted: 1, blocked: 0 })
      expect(suppliers).toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('cleans legacy KiotViet stocktake creator data from persisted dev state', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qcvl-dev-memory-'))
    const stateFile = join(dir, 'state.json')

    try {
      await writeFile(
        stateFile,
        JSON.stringify({
          version: 1,
          products: [],
          defaultSalePrices: [],
          provisionalStockBalances: [],
          draftBoms: [],
          stocktakes: [
            [
              'KK-LEGACY',
              {
                id: 'stocktake-kk-legacy',
                code: 'KK-LEGACY',
                status: 'balanced',
                source_type: 'kiotviet_import',
                created_at: '2026-07-02T00:00:00.000Z',
                balanced_at: '2026-07-03T00:00:00.000Z',
                created_by: { id: 'user-dev-admin', name: 'Admin' },
                total_actual_qty: 1,
                total_actual_value: null,
                total_difference_value: null,
                increased_qty: 0,
                decreased_qty: 0,
                note: 'Legacy imported stocktake',
              },
            ],
          ],
          stocktakeItems: [],
          users: [],
          authUsers: [],
          userOrder: [],
          groupIds: [],
          groupNamesById: [],
        }),
        'utf8',
      )

      const repository = await createDevMemoryRepository({ stateFile })
      const stocktakes = await repository.listStocktakes?.({
        organizationId: 'org-dev-memory',
        url: new URL('http://api.local/api/v1/inventory/stocktakes?search=KK-LEGACY'),
      })
      await repository.close()

      const persisted = JSON.parse(await readFile(stateFile, 'utf8'))
      expect(stocktakes?.[0]?.created_by).toBeNull()
      expect(persisted.stocktakes[0][1].created_by).toBeNull()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('allocates KiotViet delayed cashbook debt payments to oldest imported customer and supplier debts', async () => {
    const repository = await createDevMemoryRepository()
    await repository.upsertCustomersByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'XD',
        name: 'Xuan Duc',
        phone: null,
        email: null,
        address: null,
        area_name: null,
        ward_name: null,
        tax_code: null,
        customer_group_name: null,
        customer_group_id: null,
        note: null,
        customer_type: 'individual',
        company_name: null,
        source_creator_name: null,
        source_created_at: null,
        last_transaction_at: null,
        kiotviet_current_debt: null,
        kiotviet_total_sales: null,
        kiotviet_net_sales: null,
        status: 'active',
      }],
    })
    await repository.upsertSuppliersByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'NCC000011',
        name: 'In Offset SG',
        phone: null,
        email: null,
        address: null,
        area_name: null,
        ward_name: null,
        tax_code: null,
        note: null,
        company_name: null,
        source_creator_name: null,
        source_created_at: null,
        status: 'active',
        kiotviet_current_payable: null,
        kiotviet_total_purchase: null,
        kiotviet_net_purchase: null,
      }],
    })
    await repository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'TEST-PROD',
        name: 'Test product',
        status: 'active',
        product_group_id: null,
        unit_name: 'cai',
        sell_method: 'quantity',
        product_kind: 'goods',
        inventory_shape: 'normal',
        track_inventory: true,
        latest_purchase_cost: 1000,
        unit_conversions: [],
        source_created_at: null,
        source: null,
      }],
    })
    await repository.saveSalesDocument?.({
      organizationId: 'org-dev-memory',
      document: {
        id: 'order-old',
        code: 'HD-OLD',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-01T00:00:00.000Z',
        customer: { id: 'customer-kv-xd', code: 'XD', name: 'Xuan Duc', phone: null },
        seller: { id: 'user-dev-admin', name: 'Admin' },
        subtotal_amount: 200000,
        discount_amount: 0,
        total_amount: 200000,
        paid_amount: 0,
        debt_amount: 200000,
        payment_status: 'unpaid',
        note: null,
        items: [],
      },
      cashbookEntries: [],
    })
    await repository.saveSalesDocument?.({
      organizationId: 'org-dev-memory',
      document: {
        id: 'order-new',
        code: 'HD-NEW',
        order_type: 'invoice',
        status: 'completed',
        created_at: '2026-07-02T00:00:00.000Z',
        customer: { id: 'customer-kv-xd', code: 'XD', name: 'Xuan Duc', phone: null },
        seller: { id: 'user-dev-admin', name: 'Admin' },
        subtotal_amount: 300000,
        discount_amount: 0,
        total_amount: 300000,
        paid_amount: 0,
        debt_amount: 300000,
        payment_status: 'unpaid',
        note: null,
        items: [],
      },
      cashbookEntries: [],
    })
    await repository.upsertImportedKiotVietPurchaseReceipts?.({
      organizationId: 'org-dev-memory',
      rows: [
        {
          rowNumber: 2,
          source_code: 'PN-OLD',
          received_at: '2026-07-01T00:00:00.000Z',
          source_created_at: null,
          updated_at: null,
          supplier_code: 'NCC000011',
          supplier_name: 'In Offset SG',
          supplier_phone: null,
          supplier_address: null,
          received_by_name: null,
          source_creator_name: null,
          subtotal_amount: 90000,
          receipt_discount_amount: 0,
          payable_amount: 90000,
          paid_amount: 0,
          note: null,
          supplier_document_no: null,
          total_quantity: 1,
          total_item_count: 1,
          status: 'posted',
          product_code: 'TEST-PROD',
          product_name: 'Test product',
          brand_name: null,
          unit_name: 'cai',
          product_note: null,
          list_unit_cost: null,
          line_discount_percent: null,
          line_discount_amount: 0,
          unit_cost: 90000,
          line_amount: 90000,
          quantity: 1,
        },
        {
          rowNumber: 3,
          source_code: 'PN-NEW',
          received_at: '2026-07-02T00:00:00.000Z',
          source_created_at: null,
          updated_at: null,
          supplier_code: 'NCC000011',
          supplier_name: 'In Offset SG',
          supplier_phone: null,
          supplier_address: null,
          received_by_name: null,
          source_creator_name: null,
          subtotal_amount: 90000,
          receipt_discount_amount: 0,
          payable_amount: 90000,
          paid_amount: 0,
          note: null,
          supplier_document_no: null,
          total_quantity: 1,
          total_item_count: 1,
          status: 'posted',
          product_code: 'TEST-PROD',
          product_name: 'Test product',
          brand_name: null,
          unit_name: 'cai',
          product_note: null,
          list_unit_cost: null,
          line_discount_percent: null,
          line_discount_amount: 0,
          unit_cost: 90000,
          line_amount: 90000,
          quantity: 1,
        },
      ],
    })

    await repository.upsertImportedKiotVietCashbook?.({
      organizationId: 'org-dev-memory',
      rows: [
        {
          rowNumber: 2,
          source_code: 'TT001842',
          entry_time: '2026-07-08T00:57:00.000Z',
          source_created_at: null,
          source_creator_name: 'Linh',
          staff_name: null,
          category_name: 'Thu Tien khach tra',
          account_type: 'bank',
          account_name: 'MB',
          account_number: '0947900909',
          counterparty_code: 'XD',
          counterparty_name: 'Xuan Duc',
          counterparty_phone: null,
          counterparty_address: null,
          transfer_content: null,
          source_note: null,
          direction: 'in',
          amount_delta: 250000,
          book_type_name: 'Ngan hang',
          status: 'posted',
        },
        {
          rowNumber: 3,
          source_code: 'PC000046',
          entry_time: '2026-07-03T03:54:00.000Z',
          source_created_at: null,
          source_creator_name: 'Lam',
          staff_name: null,
          category_name: 'Chi Tien tra NCC',
          account_type: 'bank',
          account_name: 'CTBC',
          account_number: '7059359298',
          counterparty_code: 'NCC000011',
          counterparty_name: 'In Offset SG',
          counterparty_phone: null,
          counterparty_address: null,
          transfer_content: null,
          source_note: null,
          direction: 'out',
          amount_delta: -120000,
          book_type_name: 'Ngan hang',
          status: 'posted',
        },
      ],
    })

    const salesDocuments = await repository.listSalesDocuments?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/sales-documents?customer_id=customer-kv-xd&page=1&page_size=100'),
    })
    const receipts = await repository.listPurchaseReceipts?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/purchase/receipts?page=1&page_size=100'),
    })
    const cashbook = await repository.listCashbookEntries?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/finance/cashbook?page=1&page_size=100&status=posted'),
    })

    expect(salesDocuments?.find((document) => document.code === 'HD-OLD')).toMatchObject({ paid_amount: 200000, debt_amount: 0, payment_status: 'paid' })
    expect(salesDocuments?.find((document) => document.code === 'HD-NEW')).toMatchObject({ paid_amount: 50000, debt_amount: 250000, payment_status: 'partial' })
    expect(receipts?.find((receipt) => receipt.code === 'PN-OLD')).toMatchObject({ paid_amount: 90000, remaining_amount: 0 })
    expect(receipts?.find((receipt) => receipt.code === 'PN-NEW')).toMatchObject({ paid_amount: 30000, remaining_amount: 60000 })
    expect(cashbook?.find((entry) => entry.code === 'TT001842')?.allocations?.map((allocation) => [allocation.order_code, allocation.allocated_amount])).toEqual([
      ['HD-OLD', 200000],
      ['HD-NEW', 50000],
    ])
    expect(cashbook?.find((entry) => entry.code === 'PC000046')?.allocations?.map((allocation) => [allocation.order_code, allocation.allocated_amount])).toEqual([
      ['PN-OLD', 90000],
      ['PN-NEW', 30000],
    ])
  })

  it('rebuilds KiotViet imported document payments from cashbook instead of exported paid totals', async () => {
    const repository = await createDevMemoryRepository()
    await repository.upsertCustomersByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'XD',
        name: 'Xuan Duc',
        phone: null,
        email: null,
        address: null,
        area_name: null,
        ward_name: null,
        tax_code: null,
        customer_group_name: null,
        customer_group_id: null,
        note: null,
        customer_type: 'individual',
        company_name: null,
        source_creator_name: null,
        source_created_at: null,
        last_transaction_at: null,
        kiotviet_current_debt: null,
        kiotviet_total_sales: null,
        kiotviet_net_sales: null,
        status: 'active',
      }],
    })
    await repository.upsertSuppliersByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'NCC000011',
        name: 'In Offset SG',
        phone: null,
        email: null,
        address: null,
        area_name: null,
        ward_name: null,
        tax_code: null,
        note: null,
        company_name: null,
        source_creator_name: null,
        source_created_at: null,
        status: 'active',
        kiotviet_current_payable: null,
        kiotviet_total_purchase: null,
        kiotviet_net_purchase: null,
      }],
    })
    await repository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'TEST-PROD',
        name: 'Test product',
        status: 'active',
        product_group_id: null,
        unit_name: 'cai',
        sell_method: 'quantity',
        product_kind: 'goods',
        inventory_shape: 'normal',
        track_inventory: true,
        latest_purchase_cost: 1000,
        unit_conversions: [],
        source_created_at: null,
        source: null,
      }],
    })
    await repository.upsertImportedKiotVietInvoices?.({
      organizationId: 'org-dev-memory',
      rows: [
        {
          rowNumber: 2,
          source_code: 'HD010001',
          created_at: '2026-07-01T00:00:00.000Z',
          updated_at: null,
          customer_code: 'XD',
          customer_name: 'Xuan Duc',
          customer_phone: null,
          customer_address: null,
          price_list_name: null,
          source_user_name: null,
          channel_name: null,
          note: null,
          subtotal_amount: 100000,
          invoice_discount_amount: 0,
          other_income_amount: 0,
          total_amount: 100000,
          paid_amount: 100000,
          cash_amount: 0,
          bank_amount: 100000,
          status: 'completed',
          product_code: 'TEST-PROD',
          product_name: 'Test product',
          unit_name: 'cai',
          product_note: null,
          quantity: 1,
          list_unit_price: 100000,
          line_discount_percent: null,
          line_discount_amount: 0,
          unit_price: 100000,
          line_amount: 100000,
        },
        {
          rowNumber: 3,
          source_code: 'HD011149',
          created_at: '2026-07-02T00:00:00.000Z',
          updated_at: null,
          customer_code: 'XD',
          customer_name: 'Xuan Duc',
          customer_phone: null,
          customer_address: null,
          price_list_name: null,
          source_user_name: null,
          channel_name: null,
          note: null,
          subtotal_amount: 220000,
          invoice_discount_amount: 0,
          other_income_amount: 0,
          total_amount: 220000,
          paid_amount: 220000,
          cash_amount: 0,
          bank_amount: 220000,
          status: 'completed',
          product_code: 'TEST-PROD',
          product_name: 'Test product',
          unit_name: 'cai',
          product_note: null,
          quantity: 1,
          list_unit_price: 220000,
          line_discount_percent: null,
          line_discount_amount: 0,
          unit_price: 220000,
          line_amount: 220000,
        },
      ],
    })
    await repository.upsertImportedKiotVietPurchaseReceipts?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        source_code: 'PN000685',
        received_at: '2026-07-02T00:00:00.000Z',
        source_created_at: null,
        updated_at: null,
        supplier_code: 'NCC000011',
        supplier_name: 'In Offset SG',
        supplier_phone: null,
        supplier_address: null,
        received_by_name: null,
        source_creator_name: null,
        subtotal_amount: 90000,
        receipt_discount_amount: 0,
        payable_amount: 90000,
        paid_amount: 90000,
        note: null,
        supplier_document_no: null,
        total_quantity: 1,
        total_item_count: 1,
        status: 'posted',
        product_code: 'TEST-PROD',
        product_name: 'Test product',
        brand_name: null,
        unit_name: 'cai',
        product_note: null,
        list_unit_cost: null,
        line_discount_percent: null,
        line_discount_amount: 0,
        unit_cost: 90000,
        line_amount: 90000,
        quantity: 1,
      }],
    })

    await repository.upsertImportedKiotVietCashbook?.({
      organizationId: 'org-dev-memory',
      rows: [
        {
          rowNumber: 4,
          source_code: 'PCPN000685',
          entry_time: '2026-07-02T02:00:00.000Z',
          source_created_at: null,
          source_creator_name: null,
          staff_name: null,
          category_name: 'Phiếu chi Tiền trả NCC',
          account_type: 'bank',
          account_name: 'MB',
          account_number: '0947900909',
          counterparty_code: 'NCC000011',
          counterparty_name: 'In Offset SG',
          counterparty_phone: null,
          counterparty_address: null,
          transfer_content: null,
          source_note: null,
          direction: 'out',
          amount_delta: -90000,
          book_type_name: 'Ngan hang',
          status: 'posted',
        },
        {
          rowNumber: 3,
          source_code: 'TTHD011149',
          entry_time: '2026-07-02T01:00:00.000Z',
          source_created_at: null,
          source_creator_name: null,
          staff_name: null,
          category_name: 'Phiếu thu Tiền khách trả',
          account_type: 'bank',
          account_name: 'MB',
          account_number: '0947900909',
          counterparty_code: null,
          counterparty_name: null,
          counterparty_phone: null,
          counterparty_address: null,
          transfer_content: null,
          source_note: null,
          direction: 'in',
          amount_delta: 220000,
          book_type_name: 'Ngan hang',
          status: 'posted',
        },
        {
          rowNumber: 2,
          source_code: 'TT001842',
          entry_time: '2026-07-03T00:00:00.000Z',
          source_created_at: null,
          source_creator_name: null,
          staff_name: null,
          category_name: 'Phiếu thu Tiền khách trả',
          account_type: 'bank',
          account_name: 'MB',
          account_number: '0947900909',
          counterparty_code: 'XD',
          counterparty_name: 'Xuan Duc',
          counterparty_phone: null,
          counterparty_address: null,
          transfer_content: null,
          source_note: null,
          direction: 'in',
          amount_delta: 100000,
          book_type_name: 'Ngan hang',
          status: 'posted',
        },
      ],
    })

    const salesDocuments = await repository.listSalesDocuments?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/sales-documents?page=1&page_size=100&status=all'),
    })
    const receipts = await repository.listPurchaseReceipts?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/purchase/receipts?page=1&page_size=100&status=all'),
    })
    const cashbook = await repository.listCashbookEntries?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/finance/cashbook?page=1&page_size=100&status=posted'),
    })

    expect(salesDocuments?.find((document) => document.code === 'HD010001')).toMatchObject({ paid_amount: 100000, debt_amount: 0, payment_status: 'paid' })
    expect(salesDocuments?.find((document) => document.code === 'HD011149')).toMatchObject({ paid_amount: 220000, debt_amount: 0, payment_status: 'paid' })
    expect(receipts?.find((receipt) => receipt.code === 'PN000685')).toMatchObject({ paid_amount: 90000, remaining_amount: 0 })
    expect(cashbook?.find((entry) => entry.code === 'TTHD011149')?.allocations?.map((allocation) => [allocation.order_code, allocation.allocated_amount])).toEqual([
      ['HD011149', 220000],
    ])
    expect(cashbook?.find((entry) => entry.code === 'TT001842')?.allocations?.map((allocation) => [allocation.order_code, allocation.allocated_amount])).toEqual([
      ['HD010001', 100000],
    ])
    expect(cashbook?.find((entry) => entry.code === 'PCPN000685')?.allocations?.map((allocation) => [allocation.order_code, allocation.allocated_amount])).toEqual([
      ['PN000685', 90000],
    ])
  })

  test('filters imported purchase receipts by supplier code when supplier id differs', async () => {
    const repository = await createDevMemoryRepository()
    await repository.upsertProductsByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'HH000001',
        name: 'Hàng test',
        product_group_name: null,
        product_group_id: null,
        product_kind: 'goods',
        inventory_shape: 'normal',
        sell_method: 'quantity',
        track_inventory: true,
        unit_name: 'Cái',
        latest_purchase_cost: 2010000,
        status: 'active',
        unit_conversions: [],
        sale_price: null,
        provisional_stock: null,
        bom_text: null,
        source_created_at: null,
        ignored: { brand: null, min_stock: null, max_stock: null, direct_sale: null, location: null },
      }],
    })
    await repository.upsertSuppliersByCode?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        code: 'NCC000038',
        name: 'O Hoa',
        phone: null,
        email: null,
        address: null,
        area_name: null,
        ward_name: null,
        tax_code: null,
        note: null,
        company_name: null,
        source_creator_name: null,
        source_created_at: null,
        status: 'active',
        kiotviet_current_payable: null,
        kiotviet_total_purchase: null,
        kiotviet_net_purchase: null,
      }],
    })
    await repository.upsertImportedKiotVietPurchaseReceipts?.({
      organizationId: 'org-dev-memory',
      rows: [{
        rowNumber: 2,
        source_code: 'PN000502',
        received_at: '2025-12-20T10:49:00.000Z',
        source_created_at: null,
        updated_at: null,
        supplier_code: 'NCC000038',
        supplier_name: 'O Hoa',
        supplier_phone: null,
        supplier_address: null,
        received_by_name: null,
        source_creator_name: 'Nguyễn Thị Bích Nương',
        subtotal_amount: 2010000,
        receipt_discount_amount: 0,
        payable_amount: 2010000,
        paid_amount: 2010000,
        note: null,
        supplier_document_no: null,
        total_quantity: 1,
        total_item_count: 1,
        status: 'posted',
        product_code: 'HH000001',
        product_name: 'Hàng test',
        brand_name: null,
        unit_name: 'Cái',
        product_note: null,
        list_unit_cost: null,
        line_discount_percent: null,
        line_discount_amount: 0,
        unit_cost: 2010000,
        quantity: 1,
        line_total: 2010000,
      }],
    })

    const receipts = await repository.listPurchaseReceipts?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/purchase/receipts?supplier_id=internal-id-that-does-not-match&supplier_code=NCC000038&status=posted&page=1&page_size=100'),
    })

    expect(receipts?.map((receipt) => receipt.code)).toEqual(['PN000502'])
  })

  test('serves canonical customer debt list/detail and collects debt against real invoices', async () => {
    const repository = await createDevMemoryRepository()

    function invoiceDocument(id: string, code: string, createdAt: string, amount: number): SalesDocumentData {
      return {
        id,
        code,
        order_type: 'invoice',
        status: 'completed',
        created_at: createdAt,
        customer: { id: 'customer-debt-test', code: 'KHDEBT', name: 'Khach cong no', phone: null },
        seller: { id: 'user-dev-admin', name: 'Admin' },
        subtotal_amount: amount,
        discount_amount: 0,
        total_amount: amount,
        paid_amount: 0,
        debt_amount: amount,
        payment_status: 'unpaid',
        note: null,
        items: [],
      }
    }
    await repository.createCustomer?.({
      organizationId: 'org-dev-memory',
      code: 'KHDEBT',
      name: 'Khach cong no',
    })
    const customer = await repository.findCustomerByCode?.({ organizationId: 'org-dev-memory', code: 'KHDEBT' })
    const customerId = customer?.id ?? 'customer-debt-test'
    await repository.saveSalesDocument?.({
      organizationId: 'org-dev-memory',
      document: { ...invoiceDocument('order-debt-old', 'HD020001', '2026-07-10T08:00:00.000Z', 100000), customer: { id: customerId, code: 'KHDEBT', name: 'Khach cong no', phone: null } },
      cashbookEntries: [],
    })
    await repository.saveSalesDocument?.({
      organizationId: 'org-dev-memory',
      document: { ...invoiceDocument('order-debt-new', 'HD020002', '2026-07-12T08:00:00.000Z', 200000), customer: { id: customerId, code: 'KHDEBT', name: 'Khach cong no', phone: null } },
      cashbookEntries: [],
    })

    const listBefore = await repository.listCustomerDebts?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/finance/customer-debts'),
    })
    expect(listBefore?.find((debt) => debt.customer_id === customerId)).toMatchObject({
      total_debt: 300000,
      open_invoice_count: 2,
      oldest_order_code: 'HD020001',
    })

    const collected = await repository.collectCustomerDebt?.({
      organizationId: 'org-dev-memory',
      customerId,
      amount: 150000,
      createdAt: '2026-07-20T08:15:00.000Z',
      cashAmount: 150000,
      bankAmount: 0,
    })
    expect(collected).toMatchObject({ allocated_amount: 150000 })
    expect(collected?.payment_receipt_id).toMatch(/^TT\d{6}$/)

    const debt = await repository.getCustomerDebt?.({ organizationId: 'org-dev-memory', customerId })
    expect(debt?.total_debt).toBe(150000)
    expect(debt?.invoices).toEqual([
      expect.objectContaining({ order_code: 'HD020002', remaining_debt: 150000 }),
    ])

    const totals = await repository.getCustomerFinancialTotals?.('org-dev-memory')
    expect(totals?.get(customerId)?.total_debt_amount).toBe(150000)

    const documents = await repository.listSalesDocuments?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/sales-documents?page=1&page_size=100&status=all'),
    })
    expect(documents?.find((document) => document.code === 'HD020001')).toMatchObject({ paid_amount: 100000, debt_amount: 0, payment_status: 'paid' })
    expect(documents?.find((document) => document.code === 'HD020002')).toMatchObject({ paid_amount: 50000, debt_amount: 150000, payment_status: 'partial' })

    const cashbook = await repository.listCashbookEntries?.({
      organizationId: 'org-dev-memory',
      url: new URL('http://api.local/api/v1/finance/cashbook?page=1&page_size=100&status=posted'),
    })
    const receiptEntry = cashbook?.find((entry) => entry.code === collected?.payment_receipt_id)
    expect(receiptEntry).toMatchObject({ direction: 'in', amount_delta: 150000, source_type: 'payment_receipt_method', created_at: '2026-07-20T08:15:00.000Z' })
    expect(receiptEntry?.allocations?.map((allocation) => [allocation.order_code, allocation.allocated_amount])).toEqual([
      ['HD020001', 100000],
      ['HD020002', 50000],
    ])
  })
})
