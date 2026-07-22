import type { ReactNode, KeyboardEvent } from 'react'
import { EmptyState, MoneyText } from '../../components/ui-shell/primitives'
import {
  ManagementDataTable,
  ManagementListSurface,
  ManagementTableCheckboxControl,
  ManagementTableFavoriteButton,
  ManagementTableFooter,
  ManagementTableViewport,
} from '../../components/ui-shell/management-layout'
import { ManagementSortableHeader } from '../../components/ui-shell/management-sortable-header'
import type { ManagementSortState } from '../../components/ui-shell/management-table-sort'
import { quantityText } from './purchase-receipt-presenter'
import { receiptTotalQuantity } from './purchase-receipt-calculations'
import type { PurchaseReceipt } from './purchase-receipt-types'

export type PurchaseReceiptSortKey = 'code' | 'received_at' | 'supplier_name' | 'total_quantity' | 'subtotal_amount' | 'payable_amount' | 'paid_amount'

export function PurchaseReceiptList({
  receipts,
  favoriteReceiptIds,
  showFavoriteReceiptsOnly,
  loadingReceiptId,
  editingId,
  receiptSortState,
  canGoNext,
  canGoPrevious,
  page,
  pageSize,
  total,
  totalPages,
  renderDetail,
  onOpenReceipt,
  onToggleFavoriteReceipt,
  onToggleFavoritesOnly,
  onRequestSort,
  onGoToPage,
  onPageSizeChange,
}: {
  receipts: PurchaseReceipt[]
  favoriteReceiptIds: string[]
  showFavoriteReceiptsOnly: boolean
  loadingReceiptId: string | null
  editingId: string | null
  receiptSortState: ManagementSortState<PurchaseReceiptSortKey>
  canGoNext: boolean
  canGoPrevious: boolean
  page: number
  pageSize: number
  total: number
  totalPages: number
  renderDetail: (receipt: PurchaseReceipt) => ReactNode
  onOpenReceipt: (receipt: PurchaseReceipt) => void
  onToggleFavoriteReceipt: (receipt: PurchaseReceipt) => void
  onToggleFavoritesOnly: () => void
  onRequestSort: (key: PurchaseReceiptSortKey) => void
  onGoToPage: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  return (
    <ManagementListSurface ariaLabel="Danh sách phiếu nhập">
      <>
        {receipts.length === 0 ? (
          <EmptyState>
            <p>Không có phiếu nhập phù hợp. Thử mở rộng ngày hoặc trạng thái.</p>
          </EmptyState>
        ) : (
          <ManagementTableViewport>
            <ManagementDataTable
              ariaLabel="Danh sách phiếu nhập"
              columns={[
                {
                  key: 'select',
                  className: 'finance-cashbook-select-column',
                  header: <ManagementTableCheckboxControl ariaLabel="Chọn tất cả phiếu nhập" />,
                  cell: (receipt) => (
                    <ManagementTableCheckboxControl
                      ariaLabel={`Chọn phiếu nhập ${receipt.code}`}
                      onClick={(event) => event.stopPropagation()}
                    />
                  ),
                },
                {
                  key: 'favorite',
                  className: 'finance-cashbook-star-column',
                  header: (
                    <ManagementTableFavoriteButton
                      active={showFavoriteReceiptsOnly}
                      ariaLabel={showFavoriteReceiptsOnly ? 'Hiện tất cả phiếu nhập' : 'Chỉ hiện phiếu nhập ưu tiên'}
                      onClick={onToggleFavoritesOnly}
                    />
                  ),
                  cell: (receipt) => (
                    <ManagementTableFavoriteButton
                      active={favoriteReceiptIds.includes(receipt.id)}
                      ariaLabel={favoriteReceiptIds.includes(receipt.id) ? `Bỏ ưu tiên ${receipt.code}` : `Đánh dấu ưu tiên ${receipt.code}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onToggleFavoriteReceipt(receipt)
                      }}
                    />
                  ),
                },
                {
                  key: 'code',
                  header: <ManagementSortableHeader kind="text" sortKey="code" sortState={receiptSortState} onSort={onRequestSort}>Mã nhập hàng</ManagementSortableHeader>,
                  headerIsCell: true,
                  cell: (receipt) => (
                    <button
                      className="management-link-button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpenReceipt(receipt)
                      }}
                    >
                      <strong>{receipt.code}</strong>
                    </button>
                  ),
                },
                {
                  key: 'supplier-name',
                  header: <ManagementSortableHeader kind="text" sortKey="supplier_name" sortState={receiptSortState} onSort={onRequestSort}>Nhà cung cấp</ManagementSortableHeader>,
                  headerIsCell: true,
                  cell: (receipt) => receipt.supplier.name,
                },
                {
                  key: 'total-quantity',
                  header: <ManagementSortableHeader kind="number" sortKey="total_quantity" sortState={receiptSortState} onSort={onRequestSort}>Số lượng</ManagementSortableHeader>,
                  headerIsCell: true,
                  cell: (receipt) => quantityText(receiptTotalQuantity(receipt)),
                },
                {
                  key: 'subtotal',
                  header: <ManagementSortableHeader kind="number" sortKey="subtotal_amount" sortState={receiptSortState} onSort={onRequestSort}>Thành tiền</ManagementSortableHeader>,
                  headerIsCell: true,
                  cell: (receipt) => <MoneyText value={receipt.subtotal_amount} />,
                },
                {
                  key: 'payable',
                  header: <ManagementSortableHeader kind="number" sortKey="payable_amount" sortState={receiptSortState} onSort={onRequestSort}>Cần trả</ManagementSortableHeader>,
                  headerIsCell: true,
                  cell: (receipt) => <MoneyText value={receipt.payable_amount} />,
                },
                {
                  key: 'paid',
                  header: <ManagementSortableHeader kind="number" sortKey="paid_amount" sortState={receiptSortState} onSort={onRequestSort}>Đã trả</ManagementSortableHeader>,
                  headerIsCell: true,
                  cell: (receipt) => <MoneyText value={receipt.paid_amount} />,
                },
              ]}
              getDetailLabel={(receipt) => `Chi tiết phiếu nhập ${receipt.code}`}
              getRowKey={(receipt) => receipt.id}
              items={receipts}
              renderDetail={renderDetail}
              selectedRowKey={loadingReceiptId ?? editingId}
              onRowClick={onOpenReceipt}
              onRowKeyDown={(receipt, event: KeyboardEvent<HTMLTableRowElement>) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpenReceipt(receipt)
                }
              }}
            />
          </ManagementTableViewport>
        )}
        <ManagementTableFooter
          ariaLabel="Phân trang phiếu nhập"
          canGoNext={canGoNext}
          canGoPrevious={canGoPrevious}
          entityLabel="phiếu nhập"
          page={page}
          pageSize={pageSize}
          total={total}
          onFirst={() => onGoToPage(1)}
          onLast={() => onGoToPage(totalPages)}
          onNext={() => onGoToPage(page + 1)}
          onPageChange={onGoToPage}
          onPageSizeChange={onPageSizeChange}
          onPrevious={() => onGoToPage(page - 1)}
        />
      </>
    </ManagementListSurface>
  )
}
