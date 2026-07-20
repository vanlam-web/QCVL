import { Edit3, Printer, StickyNote, Trash2 } from 'lucide-react'
import {
  ManagementDetailActionFooter,
  ManagementDetailHeader,
  ManagementDetailInfoList,
  ManagementDetailInlineNote,
  ManagementDetailPanel,
  ManagementInlineDetailTabs,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import { ManagementRecordLink, MoneyText, StatusChip, managementRecordOpenHref } from '../../components/ui-shell/primitives'
import { appRoutes } from '../../app/routes'
import {
  cashbookDetailAmountLabel,
  cashbookDetailCategoryText,
  cashbookDetailCounterpartyLabel,
  cashbookDetailCounterpartyText,
  cashbookDetailCreatorText,
  cashbookDetailPaymentMethodText,
  cashbookDetailNoteText,
  cashbookDetailPrimaryStatusText,
  cashbookDetailPrimaryStatusTone,
  cashbookDetailTitle,
  cashbookLinkedDocumentMessage,
  cashbookLinkedDocumentRows,
  financeDateText,
} from './finance-presenter'
import type { CashbookEntryDetail } from './types'

interface FinanceDetailPanelProps {
  detail: CashbookEntryDetail | null
  currentUserName?: string
  onDeleteRequest?: (detail: CashbookEntryDetail) => void
  onEditRequest?: (detail: CashbookEntryDetail) => void
  showActionFooter?: boolean
}

function linkedDocumentHref(code: string) {
  if (code.startsWith('HD')) return managementRecordOpenHref('/sales-documents', code, { type: 'invoice' })
  if (code.startsWith('PN')) return managementRecordOpenHref(appRoutes.purchaseReceipts, code)
  return null
}

export function FinanceDetailPanel({ detail, currentUserName = '', onDeleteRequest, onEditRequest, showActionFooter = true }: FinanceDetailPanelProps) {
  if (detail === null) return <p>Đang tải chi tiết...</p>
  const counterpartyLabel = cashbookDetailCounterpartyLabel(detail)
  const counterpartyText = cashbookDetailCounterpartyText(detail)

  return (
    <ManagementDetailPanel>
      <ManagementInlineDetailTabs
        activeKey="info"
        ariaLabel="Chi tiết phiếu"
        tabs={[{ key: 'info', label: 'Thông tin' }]}
      />
      <ManagementDetailHeader title={cashbookDetailTitle(detail)}>
        <StatusChip tone={cashbookDetailPrimaryStatusTone(detail)}>{cashbookDetailPrimaryStatusText(detail)}</StatusChip>
        <StatusChip tone={detail.is_business_accounted ? 'info' : 'warning'}>
          {detail.is_business_accounted ? 'Có hạch toán' : 'Không hạch toán'}
        </StatusChip>
      </ManagementDetailHeader>
      <ManagementDetailInfoList
        columns="three"
        items={[
          { label: 'Người tạo:', value: cashbookDetailCreatorText(detail) || currentUserName },
          { label: 'Thời gian:', value: financeDateText(detail.created_at) },
          { label: 'Số tiền', value: <MoneyText value={detail.amount_delta} /> },
          { label: cashbookDetailAmountLabel(detail), value: cashbookDetailCategoryText(detail) },
          { label: 'Phương thức TT', value: cashbookDetailPaymentMethodText(detail) },
          { label: counterpartyLabel, value: counterpartyText },
        ]}
      />
      <CashbookLinkedDocuments entry={detail} />
      <ManagementDetailInlineNote icon={<StickyNote aria-hidden="true" size={16} />}>
        {cashbookDetailNoteText(detail)}
      </ManagementDetailInlineNote>
      {showActionFooter ? (
        <ManagementDetailActionFooter
          leftActions={[
            {
              label: 'Xóa',
              ariaLabel: `Xóa phiếu ${detail.code}`,
              danger: true,
              icon: <Trash2 aria-hidden="true" size={16} />,
              onClick: () => onDeleteRequest?.(detail),
            },
          ]}
          rightActions={[
            {
              label: 'Sửa',
              ariaLabel: `Sửa phiếu ${detail.code}`,
              icon: <Edit3 aria-hidden="true" size={16} />,
              onClick: () => onEditRequest?.(detail),
            },
            {
              label: 'In',
              ariaLabel: `In phiếu ${detail.code}`,
              icon: <Printer aria-hidden="true" size={16} />,
            },
          ]}
        />
      ) : null}
    </ManagementDetailPanel>
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
          <table aria-label="Chứng từ liên kết" className="management-table management-detail-table management-detail-linked-table finance-cashbook-linked-documents-table">
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
                  <td>
                    {linkedDocumentHref(linkedDocument.code)
                      ? (
                          <ManagementRecordLink
                            className="finance-cashbook-linked-document-link"
                            href={linkedDocumentHref(linkedDocument.code) ?? undefined}
                          >
                            {linkedDocument.code}
                          </ManagementRecordLink>
                        )
                      : linkedDocument.code}
                  </td>
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
