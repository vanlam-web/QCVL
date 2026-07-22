import { useState } from 'react'
import { ManagementRecordLink, MoneyText, managementRecordOpenHref } from '../../components/ui-shell/primitives'
import { ManagementDetailInlineNote, ManagementTableFooter, ManagementTableViewport } from '../../components/ui-shell/management-layout'
import type { CustomerDebtDetail } from '../orders/order-service'
import {
  buildCustomerDebtSummaryRows,
  buildCustomerDebtLedgerRows,
  customerDebtHasLiveLedger,
  customerDebtLedgerRowsFromBackend,
  type CustomerDebtAdjustment,
} from './customer-debt-ledger'
import { customerDateTime as dateTime } from './customer-presenter'
import type { CustomerDebtLedgerState } from './CustomerDebtPaymentDialog'

export type CustomerDebtState = CustomerDebtDetail | 'loading' | 'error'
type CustomerDebtView = 'summary' | 'detail'

export function CustomerDebtPanel({
  debt,
  debtLedger,
  fallbackDebt,
  ledgerPage,
  ledgerPageSize,
  onOpenAdjustment,
  onLedgerPageChange,
}: {
  debt: CustomerDebtState | undefined
  debtLedger: CustomerDebtLedgerState | undefined
  fallbackDebt: number
  ledgerPage: number
  ledgerPageSize: number
  onOpenAdjustment: (adjustment: CustomerDebtAdjustment) => void
  onLedgerPageChange: (page: number) => void
}) {
  const [debtView, setDebtView] = useState<CustomerDebtView>('summary')
  const [summaryPage, setSummaryPage] = useState(1)
  if (debt === undefined || debt === 'loading' || debtLedger === undefined || debtLedger === 'loading') return <p>Đang tải công nợ...</p>
  if (debt === 'error' || debtLedger === 'error') return <p role="alert">Không tải được công nợ.</p>
  const hasLiveDebtLedger = customerDebtHasLiveLedger(debtLedger.debt)
  const totalDebt = hasLiveDebtLedger ? debtLedger.debt.total_debt : fallbackDebt
  const invoiceRows = debtLedger.invoiceHistory.length > 0
    ? debtLedger.invoiceHistory
    : debtLedger.debt.invoices.map((invoice) => ({
        id: invoice.order_id,
        code: invoice.order_code,
        created_at: invoice.created_at,
        total_amount: invoice.total_amount,
        paid_amount: invoice.paid_amount,
        debt_amount: invoice.remaining_debt,
        payment_status: invoice.remaining_debt > 0 ? 'unpaid' : 'paid',
        status: 'completed' as const,
        seller: { id: '', name: '' },
      }))
  const ledgerRows = (debtLedger.debt.ledger_rows?.length ?? 0) > 0
    ? customerDebtLedgerRowsFromBackend(debtLedger.debt)
    : buildCustomerDebtLedgerRows(
        invoiceRows,
        debtLedger.cashbookHistory,
        debtLedger.debt.adjustments ?? [],
        debtLedger.debt.linked_supplier_receipts ?? [],
        { currentTotal: totalDebt },
      )
  const totalPages = Math.max(1, Math.ceil(ledgerRows.length / ledgerPageSize))
  const safeLedgerPage = Math.min(Math.max(ledgerPage, 1), totalPages)
  const visibleLedgerRows = ledgerRows.slice((safeLedgerPage - 1) * ledgerPageSize, safeLedgerPage * ledgerPageSize)
  const summaryRows = buildCustomerDebtSummaryRows(invoiceRows, ledgerRows, totalDebt)
  const summaryTotalPages = Math.max(1, Math.ceil(summaryRows.length / ledgerPageSize))
  const safeSummaryPage = Math.min(Math.max(summaryPage, 1), summaryTotalPages)
  const visibleSummaryRows = summaryRows.slice((safeSummaryPage - 1) * ledgerPageSize, safeSummaryPage * ledgerPageSize)

  return (
    <section aria-label="Công nợ" className="customer-debt-panel">
      <div aria-label="Loại công nợ" className="customer-debt-view-toggle customer-history-type-toggle">
        <button aria-pressed={debtView === 'summary'} type="button" onClick={() => setDebtView('summary')}>
          Tóm tắt
        </button>
        <button aria-pressed={debtView === 'detail'} type="button" onClick={() => setDebtView('detail')}>
          Chi tiết
        </button>
      </div>
      {debtView === 'summary' ? (
        summaryRows.length > 0 ? (
          <>
            <ManagementTableViewport>
              <table aria-label="Tóm tắt công nợ" className="customer-debt-summary-table">
                <thead>
                  <tr>
                    <th>Mã hóa đơn</th>
                    <th>Thời gian</th>
                    <th>Còn nợ</th>
                    <th>Công nợ</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSummaryRows.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>
                        <ManagementRecordLink href={managementRecordOpenHref('/sales-documents', invoice.code, { type: 'invoice' })}>
                          {invoice.code}
                        </ManagementRecordLink>
                      </td>
                      <td>{dateTime(invoice.created_at)}</td>
                      <td><MoneyText value={invoice.remaining_debt} /></td>
                      <td><MoneyText value={invoice.running_debt} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ManagementTableViewport>
            <ManagementTableFooter
              ariaLabel="Phân trang tóm tắt công nợ"
              entityLabel="hóa đơn mở"
              page={safeSummaryPage}
              pageSize={ledgerPageSize}
              pageSizeOptions={[ledgerPageSize]}
              total={summaryRows.length}
              canGoPrevious={safeSummaryPage > 1}
              canGoNext={safeSummaryPage < summaryTotalPages}
              onFirst={() => setSummaryPage(1)}
              onPrevious={() => setSummaryPage(Math.max(1, safeSummaryPage - 1))}
              onNext={() => setSummaryPage(Math.min(summaryTotalPages, safeSummaryPage + 1))}
              onLast={() => setSummaryPage(summaryTotalPages)}
              onPageChange={(nextPage) => setSummaryPage(nextPage)}
            />
          </>
        ) : <ManagementDetailInlineNote>Không có hóa đơn chưa thanh toán.</ManagementDetailInlineNote>
      ) : ledgerRows.length > 0 ? (
        <>
          <ManagementTableViewport>
            <table aria-label="Lịch sử công nợ" className="management-detail-table management-detail-linked-table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Thời gian</th>
                  <th>Loại</th>
                  <th>Giá trị</th>
                  <th>Công nợ</th>
                </tr>
              </thead>
              <tbody>
                {visibleLedgerRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {'adjustment' in row && row.adjustment && /^CB/i.test(row.code) ? (
                        <button className="management-record-link customer-debt-record-button" type="button" onClick={() => {
                          if (row.adjustment) onOpenAdjustment(row.adjustment)
                        }}>
                          {row.code}
                        </button>
                      ) : row.href ? (
                        <ManagementRecordLink href={row.href}>
                          {row.code}
                        </ManagementRecordLink>
                      ) : <strong>{row.code}</strong>}
                    </td>
                    <td>{dateTime(row.created_at)}</td>
                    <td>{row.type}</td>
                    <td><MoneyText value={row.value_delta} /></td>
                    <td><MoneyText value={row.running_debt} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ManagementTableViewport>
          <ManagementTableFooter
            ariaLabel="Phân trang công nợ"
            entityLabel="dòng công nợ"
            page={safeLedgerPage}
            pageSize={ledgerPageSize}
            pageSizeOptions={[ledgerPageSize]}
            total={ledgerRows.length}
            canGoPrevious={safeLedgerPage > 1}
            canGoNext={safeLedgerPage < totalPages}
            onFirst={() => onLedgerPageChange(1)}
            onPrevious={() => onLedgerPageChange(Math.max(1, safeLedgerPage - 1))}
            onNext={() => onLedgerPageChange(Math.min(totalPages, safeLedgerPage + 1))}
            onLast={() => onLedgerPageChange(totalPages)}
            onPageChange={(nextPage) => onLedgerPageChange(nextPage)}
          />
        </>
      ) : <ManagementDetailInlineNote>Chưa có lịch sử công nợ.</ManagementDetailInlineNote>}
    </section>
  )
}
