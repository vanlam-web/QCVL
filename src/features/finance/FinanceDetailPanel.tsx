import { Edit3, Printer, StickyNote, Trash2 } from 'lucide-react'
import { ManagementDetailActionFooter, ManagementTableViewport } from '../../components/ui-shell/management-layout'
import { MoneyText, StatusChip } from '../../components/ui-shell/primitives'
import {
  cashbookDetailAccountLabel,
  cashbookDetailAccountText,
  cashbookDetailAmountLabel,
  cashbookDetailCategoryText,
  cashbookDetailCounterpartyLabel,
  cashbookDetailCounterpartyText,
  cashbookDetailCounterpartyTypeLabel,
  cashbookDetailCreatorText,
  cashbookDetailNoteText,
  cashbookDetailPrimaryStatusText,
  cashbookDetailPrimaryStatusTone,
  cashbookDetailTitle,
  cashbookLinkedDocumentMessage,
  cashbookLinkedDocumentRows,
  financeDateText,
  paymentMethodText,
} from './finance-presenter'
import type { CashbookEntryDetail } from './types'

interface FinanceDetailPanelProps {
  detail: CashbookEntryDetail | null
}

export function FinanceDetailPanel({ detail }: FinanceDetailPanelProps) {
  if (detail === null) return <p>Đang tải chi tiết...</p>

  return (
    <div className="management-detail-panel finance-cashbook-detail">
      <div className="inline-detail-tabbar">
        <div className="inline-detail-tabs" role="tablist" aria-label="Chi tiết phiếu">
          <button aria-selected="true" role="tab" type="button">Thông tin</button>
        </div>
      </div>
      <header className="management-detail-header">
        <h2>{cashbookDetailTitle(detail)}</h2>
        <StatusChip tone={cashbookDetailPrimaryStatusTone(detail)}>{cashbookDetailPrimaryStatusText(detail)}</StatusChip>
        <StatusChip tone={detail.is_business_accounted ? 'info' : 'warning'}>
          {detail.is_business_accounted ? 'Có hạch toán' : 'Không hạch toán'}
        </StatusChip>
      </header>
      <dl className="management-detail-meta-grid management-detail-meta-grid-four">
        <div><dt>Người tạo:</dt><dd>{cashbookDetailCreatorText(detail)}</dd></div>
        <div><dt>Thời gian:</dt><dd>{financeDateText(detail.created_at)}</dd></div>
        <div><dt>Số tiền</dt><dd><MoneyText value={detail.amount_delta} /></dd></div>
        <div><dt>{cashbookDetailAmountLabel(detail)}</dt><dd>{cashbookDetailCategoryText(detail)}</dd></div>
        <div><dt>{detail.direction === 'in' ? 'Đối tượng nộp' : 'Đối tượng nhận'}</dt><dd>{cashbookDetailCounterpartyTypeLabel(detail)}</dd></div>
        <div><dt>Phương thức thanh toán</dt><dd>{paymentMethodText(detail.payment_method)}</dd></div>
      </dl>
      <dl className="management-detail-meta-rows">
        <div>
          <dt>{cashbookDetailCounterpartyLabel(detail)}</dt>
          <dd>
            <button aria-label={`${cashbookDetailCounterpartyLabel(detail)} ${detail.counterparty.name ?? '-'}`} className="finance-cashbook-detail-link" type="button">
              {cashbookDetailCounterpartyText(detail)}
            </button>
          </dd>
        </div>
        <div><dt>{cashbookDetailAccountLabel(detail)}</dt><dd>{cashbookDetailAccountText(detail)}</dd></div>
      </dl>
      <CashbookLinkedDocuments entry={detail} />
      <div className="management-detail-inline-note">
        <StickyNote aria-hidden="true" size={16} />
        {cashbookDetailNoteText(detail)}
      </div>
      <ManagementDetailActionFooter
        leftActions={[
          {
            label: 'Xóa',
            ariaLabel: `Xóa phiếu ${detail.code}`,
            danger: true,
            icon: <Trash2 aria-hidden="true" size={16} />,
          },
        ]}
        rightActions={[
          {
            label: 'Sửa',
            ariaLabel: `Sửa phiếu ${detail.code}`,
            icon: <Edit3 aria-hidden="true" size={16} />,
          },
          {
            label: 'In',
            ariaLabel: `In phiếu ${detail.code}`,
            icon: <Printer aria-hidden="true" size={16} />,
          },
        ]}
      />
    </div>
  )
}

function CashbookLinkedDocuments({ entry }: { entry: CashbookEntryDetail }) {
  const linkedDocumentRows = cashbookLinkedDocumentRows(entry)
  if (linkedDocumentRows.length === 0) return null

  return (
    <section aria-label="Chứng từ liên kết" className="finance-cashbook-linked-documents">
      <div className="finance-cashbook-linked-documents-inner">
        <p>{cashbookLinkedDocumentMessage(entry)}</p>
        <ManagementTableViewport>
          <table aria-label="Chứng từ liên kết" className="management-table">
            <thead>
              <tr>
                <th>Mã chứng từ</th>
                <th>Thời gian</th>
                <th>{entry.direction === 'in' ? 'Tổng sau giảm' : 'Giá trị phiếu'}</th>
                <th>{entry.direction === 'in' ? 'Chưa TT' : 'Đã trả trước'}</th>
                <th>{entry.direction === 'in' ? 'Giá trị thu' : 'Giá trị chi'}</th>
              </tr>
            </thead>
            <tbody>
              {linkedDocumentRows.map((linkedDocument) => (
                <tr key={linkedDocument.id}>
                  <td>{linkedDocument.code}</td>
                  <td>{financeDateText(entry.created_at)}</td>
                  <td><MoneyText value={linkedDocument.totalAmount} /></td>
                  <td><MoneyText value={entry.direction === 'in' ? linkedDocument.remainingAmount : linkedDocument.settledBefore} /></td>
                  <td><MoneyText value={linkedDocument.allocatedAmount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </ManagementTableViewport>
      </div>
    </section>
  )
}
