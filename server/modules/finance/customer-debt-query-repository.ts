import type pg from 'pg'
import type { CustomerDebtSummaryData, ServerRepository } from '../../http.js'
import { KIOTVIET_DEBT_CASHBOOK_CODE_PATTERN, customerDebtTotalsSql, mapCustomerDebtTotalsRow, sliceCustomerOpenDebtsOldestFirst, type CustomerDebtTotalsRow } from './customer-debt.js'
import { buildPartnerDebtLedger, type PartnerDebtDocumentInput } from './partner-debt-ledger.js'
type CashbookEntry=NonNullable<Awaited<ReturnType<NonNullable<ServerRepository['getCashbookEntry']>>>>
type FinanceAccount=Awaited<ReturnType<NonNullable<ServerRepository['listFinanceAccounts']>>>[number]
type DebtQueryDeps={ensureTables(pool:pg.Pool):Promise<void>;ensureSnapshots(pool:pg.Pool):Promise<void>;userNames(pool:pg.Pool,organizationId:string):Promise<ReadonlyMap<string,string>>;accountsForExclusion(pool:pg.Pool,organizationId:string):Promise<FinanceAccount[]>;mapCashbook(row:Record<string,unknown>):CashbookEntry;hydrateUser(entry:CashbookEntry,names:ReadonlyMap<string,string>):CashbookEntry;hydrateAccount(entry:CashbookEntry,accounts:FinanceAccount[]):CashbookEntry;nextSupplierPaymentCode(receiptCode:string,suffix:string):string;matches(url:URL,debt:CustomerDebtSummaryData):boolean}
export function createCustomerDebtQueryRepository(pool:pg.Pool,deps:DebtQueryDeps):Pick<ServerRepository,'getCustomerDebt'|'getCustomerOpenDebts'|'listCustomerDebts'>{const {ensureTables,ensureSnapshots,userNames,accountsForExclusion,mapCashbook,hydrateUser,hydrateAccount,nextSupplierPaymentCode,matches}=deps;return{
    async getCustomerDebt(input) {
      await ensureTables(pool)
      await ensureSnapshots(pool)
      const [totalsResult, result, ledgerInvoiceResult, adjustmentResult, linkedSupplierReceiptResult] = await Promise.all([
        pool.query<CustomerDebtTotalsRow>(
          customerDebtTotalsSql({ singleCustomer: true }),
          [input.organizationId, input.customerId],
        ),
        pool.query(
          `
            select
              o.id,
              o.code,
              o.created_at,
              o.total_amount,
              o.paid_amount,
              o.debt_amount,
              coalesce(cde.remaining_debt, o.debt_amount) as remaining_debt,
              coalesce(cde.updated_at, o.updated_at) as debt_updated_at
            from orders o
            left join customer_debt_entries cde
              on cde.organization_id = o.organization_id
             and cde.order_id = o.id
             and cde.status = 'open'
             and cde.remaining_debt > 0
            where o.organization_id = $1
              and o.customer_id = $2
              and o.order_type = 'invoice'
              and o.status <> 'cancelled'
              and coalesce(cde.remaining_debt, o.debt_amount) > 0
            order by debt_updated_at desc, o.created_at desc
          `,
          [input.organizationId, input.customerId],
        ),
        pool.query(
          `
            select
              o.id,
              o.code,
              o.created_at,
              o.total_amount as ledger_total_amount
            from orders o
            where o.organization_id = $1
              and o.customer_id = $2
              and o.order_type = 'invoice'
              and o.status <> 'cancelled'
            order by o.created_at asc, o.code asc
          `,
          [input.organizationId, input.customerId],
        ),
        pool.query(
          `
            select id, source_code, created_at, transaction_type, amount_delta, paid_amount, remaining_amount, balance_after, source_file
            from customer_debt_adjustments
            where organization_id = $1
              and customer_id = $2
              and source_system = 'kiotviet'
            order by created_at desc, source_row desc nulls last, updated_at desc
          `,
          [input.organizationId, input.customerId],
        ),
        pool.query(
          `
            select
              pr.id::text,
              pr.code,
              coalesce(nullif(pr.data->>'received_at', '')::timestamptz, pr.created_at) as created_at,
              s.id::text as supplier_id,
              s.code as supplier_code,
              s.data->>'name' as supplier_name,
              coalesce(nullif(pr.data->>'payable_amount', '')::numeric, 0) as payable_amount,
              coalesce(nullif(pr.data->>'paid_amount', '')::numeric, 0) as paid_amount,
              coalesce(nullif(pr.data->>'remaining_amount', '')::numeric, 0) as remaining_amount
            from purchase_receipt_snapshots pr
            join supplier_snapshots s
              on s.organization_id = pr.organization_id
             and (
               pr.data->>'supplier_id' = s.id
               or pr.data->'supplier'->>'id' = s.id
               or lower(s.code) = lower(pr.data->'supplier'->>'code')
               or s.id = 'supplier-kv-' || lower(regexp_replace(coalesce(pr.data->'supplier'->>'code', ''), '\\{DEL[0-9]*\\}$', '', 'i'))
             )
             and s.data->>'linked_customer_id' = $2
            where pr.organization_id = $1
              and pr.data->>'status' = 'posted'
              and coalesce(nullif(pr.data->>'remaining_amount', '')::numeric, 0) > 0
            order by created_at desc, pr.code desc
          `,
          [input.organizationId, input.customerId],
        ),
      ])
      const totalsRow = totalsResult.rows[0]
      const customerCode = totalsRow ? mapCustomerDebtTotalsRow(totalsRow).customer_code : ''
      const cashbookResult = customerCode
        ? await pool.query(
            `
              select
                cbe.id,
                cbe.code,
                cbe.status,
                cbe.direction,
                cbe.amount_delta,
                cbe.finance_account,
                cbe.is_business_accounted,
                cbe.source_type,
                cbe.created_at,
                cbe.note,
                cbe.counterparty,
                cbe.created_by,
                cbe.source,
                cbe.allocations
              from cashbook_entries cbe
              left join orders o
                on o.organization_id = cbe.organization_id
               and o.code = cbe.source->>'order_code'
              left join customer_snapshots cs
                on cs.organization_id = cbe.organization_id
               and (
                 lower(cs.code) = lower(cbe.source->>'counterparty_code')
                 or cs.id = 'customer-kv-' || lower(regexp_replace(coalesce(cbe.source->>'counterparty_code', ''), '\\{DEL[0-9]*\\}$', '', 'i'))
               )
              where cbe.organization_id = $1
                and cbe.status = 'posted'
                and (
                  (
                    cbe.source_type = 'payment_receipt_method'
                    and (
                      cbe.source->>'customer_id' = $2
                      or (o.id is not null and o.customer_id = $2 and o.status <> 'cancelled')
                    )
                  )
                  or (
                    cbe.source_type = 'kiotviet_cashbook'
                    and cbe.code ~* '${KIOTVIET_DEBT_CASHBOOK_CODE_PATTERN}'
                    and (
                      cbe.source->>'customer_id' = $2
                      or cs.id = $2
                      or cbe.source->>'counterparty_code' = $3
                      or (o.id is not null and o.customer_id = $2 and o.status <> 'cancelled')
                    )
                  )
                )
              order by cbe.created_at desc, cbe.code desc
            `,
            [input.organizationId, input.customerId, customerCode],
          )
        : { rows: [] }
      const invoices = result.rows.map((row) => ({
        order_id: row.id,
        order_code: row.code,
        created_at: row.created_at.toISOString(),
        total_amount: Number(row.total_amount),
        paid_amount: Number(row.paid_amount),
        debt_amount: Number(row.debt_amount),
        remaining_debt: Number(row.remaining_debt),
      }))
      const adjustments = adjustmentResult.rows.map((row) => ({
        id: String(row.id),
        source_code: String(row.source_code),
        created_at: row.created_at.toISOString(),
        transaction_type: String(row.transaction_type),
        amount_delta: Number(row.amount_delta),
        paid_amount: Number(row.paid_amount),
        remaining_amount: Number(row.remaining_amount),
        balance_after: Number(row.balance_after),
        source_file: row.source_file === null ? null : String(row.source_file),
      }))
      const linkedSupplierReceipts = linkedSupplierReceiptResult.rows.map((row) => ({
        id: String(row.id),
        code: String(row.code),
        created_at: row.created_at.toISOString(),
        supplier_id: String(row.supplier_id),
        supplier_code: String(row.supplier_code),
        supplier_name: String(row.supplier_name),
        payable_amount: Number(row.payable_amount),
        paid_amount: Number(row.paid_amount),
        remaining_amount: Number(row.remaining_amount),
      }))
      const userDisplayNames = await userNames(pool, input.organizationId)
      const accounts = await accountsForExclusion(pool, input.organizationId)
      const cashbookEntries = cashbookResult.rows
        .map(mapCashbook)
        .map((entry) => hydrateUser(entry, userDisplayNames))
        .map((entry) => hydrateAccount(entry, accounts))
      const ledgerInvoices = ledgerInvoiceResult.rows.length > 0
        ? ledgerInvoiceResult.rows.map((row) => ({
            order_id: row.id,
            order_code: row.code,
            created_at: row.created_at.toISOString(),
            total_amount: Number(row.ledger_total_amount),
          }))
        : invoices
      const ledgerDocuments: PartnerDebtDocumentInput[] = [
        ...ledgerInvoices.map((invoice) => ({
          id: String(invoice.order_id),
          code: invoice.order_code,
          time: invoice.created_at,
          amount: invoice.total_amount,
          status: 'posted',
          sourceType: 'invoice',
          sourceId: String(invoice.order_id),
        })),
        ...cashbookEntries.map((entry) => ({
          id: entry.id,
          code: entry.code,
          time: entry.created_at,
          amount: Math.abs(entry.amount_delta),
          status: entry.status,
          sourceType: 'payment',
          sourceId: entry.id,
        })),
        ...adjustments.map((adjustment) => ({
          id: adjustment.id,
          code: adjustment.source_code,
          time: adjustment.created_at,
          amount: Math.abs(adjustment.amount_delta),
          normalizedAmountDelta: adjustment.amount_delta,
          status: 'posted',
          sourceType: 'adjustment',
          sourceId: adjustment.id,
        })),
        ...linkedSupplierReceipts.flatMap((receipt) => {
          const rows: PartnerDebtDocumentInput[] = [{
            id: receipt.id,
            code: receipt.code,
            time: receipt.created_at,
            amount: receipt.payable_amount,
            status: 'posted',
            sourceType: 'linked_supplier_receipt',
            sourceId: receipt.id,
          }]
          if (receipt.paid_amount > 0) {
            rows.push({
              id: `${receipt.id}:paid`,
              code: nextSupplierPaymentCode(receipt.code, ''),
              time: receipt.created_at,
              amount: receipt.paid_amount,
              status: 'posted',
              sourceType: 'linked_supplier_payment',
              sourceId: receipt.id,
            })
          }
          return rows
        }),
      ]
      const ledger = buildPartnerDebtLedger({
        view: 'customer',
        linked: linkedSupplierReceipts.length > 0,
        documents: ledgerDocuments,
      })
      return {
        customer_id: input.customerId,
        total_debt: ledger.totalDebt,
        invoices,
        adjustments,
        linked_supplier_receipts: linkedSupplierReceipts,
        cashbook_entries: cashbookEntries,
        ledger_rows: ledger.rows.map((row) => ({
          id: row.id,
          code: row.code,
          created_at: row.time,
          amount_delta: row.amountDelta,
          balance_after: row.balanceAfter,
          source_type: row.sourceType,
          source_id: row.sourceId,
        })),
      }
    },

    async getCustomerOpenDebts(input) {
      await ensureTables(pool)
      const limit = Math.max(1, Math.min(Math.floor(Number(input.limit ?? 50)), 100))
      const result = await pool.query(
        `
          select
            o.id,
            o.code,
            o.created_at,
            o.total_amount,
            o.paid_amount,
            coalesce(cde.remaining_debt, o.debt_amount) as remaining_debt
          from orders o
          left join customer_debt_entries cde
            on cde.organization_id = o.organization_id
           and cde.order_id = o.id
           and cde.status = 'open'
           and cde.remaining_debt > 0
          where o.organization_id = $1
            and o.customer_id = $2
            and o.order_type = 'invoice'
            and o.status <> 'cancelled'
            and coalesce(cde.remaining_debt, o.debt_amount) > 0
          order by o.created_at asc, o.code asc
          limit $3
        `,
        [input.organizationId, input.customerId, limit + 1],
      )
      return sliceCustomerOpenDebtsOldestFirst(
        result.rows.map((row) => ({
          order_id: String(row.id),
          order_code: String(row.code),
          created_at: row.created_at.toISOString(),
          total_amount: Number(row.total_amount),
          paid_amount: Number(row.paid_amount),
          remaining_debt: Number(row.remaining_debt),
        })),
        { amount: input.amount, limit },
      )
    },

    async listCustomerDebts(input) {
      await ensureTables(pool)
      await ensureSnapshots(pool)
      const result = await pool.query<CustomerDebtTotalsRow>(customerDebtTotalsSql(), [input.organizationId])
      const debts = result.rows
        .map((row) => {
          const mapped = mapCustomerDebtTotalsRow(row)
          return {
            customer_id: mapped.customer_id,
            customer_code: mapped.customer_code,
            customer_name: mapped.customer_name,
            total_debt: mapped.total_debt,
            oldest_order_code: mapped.oldest_order_code,
            open_invoice_count: mapped.open_invoice_count,
            invoices: [],
          } satisfies CustomerDebtSummaryData
        })
        .filter((debt) => debt.total_debt !== 0)
      return debts.filter((debt) => matches(input.url, debt))
    },

  }}
