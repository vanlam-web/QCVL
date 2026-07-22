import type { FormEvent } from 'react'
import { formatMeasure } from '../../lib/number-format'
import type { Product } from '../catalog/types'
import type { MaterialOpeningOptions, PosShortageMaterial } from '../inventory/types'
import type { CheckoutCartLine } from '../orders/order-service'
import { readNonNegativeNumber, readPositiveNumber } from './pos-core'

export function PosQuickMaterialOpeningDialog({
  error,
  line,
  optionsByProduct,
  qtyByProduct,
  saving,
  selectedIds,
  shortages,
  unitByProduct,
  onClose,
  onQtyChange,
  onSelectedChange,
  onSubmit,
  onUnitChange,
}: {
  error: string | null
  line: CheckoutCartLine
  optionsByProduct: Record<string, MaterialOpeningOptions>
  qtyByProduct: Record<string, number>
  saving: boolean
  selectedIds: Record<string, boolean>
  shortages: PosShortageMaterial[]
  unitByProduct: Record<string, string>
  onClose: () => void
  onQtyChange: (productId: string, qty: number) => void
  onSelectedChange: (productId: string, selected: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onUnitChange: (productId: string, unitId: string) => void
}) {
  return (
    <aside aria-label="Khui vật tư nhanh" aria-modal="true" className="pos-material-opening-dialog" role="dialog">
      <form onSubmit={onSubmit}>
        <header>
          <h2>Khui vật tư nhanh</h2>
          <button
            aria-label="Đóng khui vật tư nhanh"
            className="management-icon-button"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <p>{line.product.name}</p>
        {error ? <p role="alert">{error}</p> : null}
        <div className="pos-material-opening-list">
          {shortages.map((shortage) => {
            const options = optionsByProduct[shortage.product_id]
            const conversions = options?.conversions ?? shortage.conversion_options
            return (
              <section key={shortage.product_id} className="pos-material-opening-item">
                <label>
                  <input
                    aria-label={`Chọn ${shortage.name}`}
                    checked={selectedIds[shortage.product_id] ?? false}
                    type="checkbox"
                    onChange={(event) => onSelectedChange(shortage.product_id, event.target.checked)}
                  />
                  <strong>{shortage.code} {shortage.name}</strong>
                </label>
                <span>Thiếu {formatMeasure(shortage.shortage_qty)} {shortage.stock_unit.name}</span>
                <label>
                  Số lượng khui {shortage.name}
                  <input
                    aria-label={`Số lượng khui ${shortage.name}`}
                    min="0.001"
                    step="0.001"
                    type="number"
                    value={qtyByProduct[shortage.product_id] ?? 1}
                    onChange={(event) => onQtyChange(shortage.product_id, readPositiveNumber(event.target.value) || 1)}
                  />
                </label>
                <label>
                  Đơn vị khui {shortage.name}
                  <select
                    aria-label={`Đơn vị khui ${shortage.name}`}
                    value={unitByProduct[shortage.product_id] ?? conversions[0]?.unit_id ?? ''}
                    onChange={(event) => onUnitChange(shortage.product_id, event.target.value)}
                  >
                    {conversions.map((conversion) => (
                      <option key={conversion.unit_id} value={conversion.unit_id}>
                        {conversion.name} ({formatMeasure(conversion.stock_qty_per_unit)} {shortage.stock_unit.name})
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            )
          })}
        </div>
        <button className="button button-primary" disabled={saving} type="submit">
          Xác nhận khui
        </button>
      </form>
    </aside>
  )
}

export function PosManualMaterialOpeningDialog({
  error,
  oldRemaining,
  options,
  productId,
  products,
  qty,
  saving,
  unitId,
  onClose,
  onOldRemainingChange,
  onProductChange,
  onQtyChange,
  onSubmit,
  onUnitChange,
}: {
  error: string | null
  oldRemaining: number
  options?: MaterialOpeningOptions
  productId: string
  products: Product[]
  qty: number
  saving: boolean
  unitId: string
  onClose: () => void
  onOldRemainingChange: (value: number) => void
  onProductChange: (productId: string) => void
  onQtyChange: (value: number) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onUnitChange: (unitId: string) => void
}) {
  return (
    <aside aria-label="Khui vật tư thủ công" aria-modal="true" className="pos-material-opening-dialog" role="dialog">
      <form onSubmit={onSubmit}>
        <header>
          <h2>Khui vật tư thủ công</h2>
          <button
            aria-label="Đóng khui vật tư thủ công"
            className="management-icon-button"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {error ? <p role="alert">{error}</p> : null}
        <label>
          Vật tư
          <select
            aria-label="Vật tư khui thủ công"
            value={productId}
            onChange={(event) => onProductChange(event.target.value)}
          >
            <option value="">Chọn vật tư</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.code} {product.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Số lượng khui
          <input
            aria-label="Số lượng khui thủ công"
            min="0.001"
            step="0.001"
            type="number"
            value={qty}
            onChange={(event) => onQtyChange(readPositiveNumber(event.target.value))}
          />
        </label>
        <label>
          Đơn vị khui
          <select
            aria-label="Đơn vị khui thủ công"
            value={unitId}
            onChange={(event) => onUnitChange(event.target.value)}
          >
            <option value="">Chọn đơn vị</option>
            {(options?.conversions ?? []).map((conversion) => (
              <option key={conversion.unit_id} value={conversion.unit_id}>
                {conversion.name} ({formatMeasure(conversion.stock_qty_per_unit)} {options?.product.stock_unit.name})
              </option>
            ))}
          </select>
        </label>
        <label>
          Phần cũ còn lại
          <input
            aria-label="Phần cũ còn lại thủ công"
            min="0"
            step="0.001"
            type="number"
            value={oldRemaining}
            onChange={(event) => onOldRemainingChange(readNonNegativeNumber(event.target.value))}
          />
        </label>
        <button className="button button-primary" disabled={saving} type="submit">
          Xác nhận khui
        </button>
      </form>
    </aside>
  )
}
