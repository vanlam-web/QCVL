import type { ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { formatMoney } from '../../lib/number-format'

interface PosCartPanelProps {
  cartTotal: number
  lineCount: number
  hasLines: boolean
  note: string
  children: ReactNode
  onNoteChange: (value: string) => void
}

export function PosCartPanel({
  cartTotal,
  lineCount,
  hasLines,
  note,
  children,
  onNoteChange,
}: PosCartPanelProps) {
  return (
    <section aria-label="K02 giỏ hàng" className="pos-cart">
      {hasLines ? children : (
        <div className="pos-cart-empty">
          <strong>Chưa có hàng hóa</strong>
          <span>Tìm hoặc chọn hàng để thêm vào hóa đơn.</span>
        </div>
      )}
      <footer className="pos-cart-footer" aria-label="Ghi chú và tổng tiền">
        <label className="pos-cart-note">
          <Pencil aria-hidden="true" size={18} />
          <input
            aria-label="Ghi chú đơn hàng"
            placeholder="Ghi chú đơn hàng"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
          />
        </label>
        <div className="pos-cart-total" aria-label="Tổng tiền hàng">
          <span>Tổng tiền hàng</span>
          <strong>{lineCount}</strong>
          <strong>{formatMoney(cartTotal)}</strong>
        </div>
      </footer>
    </section>
  )
}
