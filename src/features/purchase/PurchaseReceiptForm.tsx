import { Plus, Save, Trash2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { ManagementDetailSection } from '../../components/ui-shell/management-layout'
import { financeAccountChoiceLabel } from '../finance/finance-presenter'
import { lineAmount, physicalSummary, rollPayload, sheetPayload } from './purchase-receipt-calculations'
import { money } from './purchase-receipt-presenter'
import type { PurchaseReceiptFinanceAccount, PurchaseReceiptInput, PurchaseReceiptProduct } from './purchase-receipt-types'
import type { Supplier } from './types'

type SheetGroup = ReturnType<typeof sheetPayload>['sheet_groups'][number]

export function PurchaseReceiptForm({
  ariaLabel,
  form,
  isReadOnly,
  products,
  suppliers,
  receiptReceivedAtText,
  rollLengthTexts,
  totals,
  lowCostWarnings,
  editingId,
  editingStatus,
  paymentMethod,
  financeAccountId,
  bankAccounts,
  saving,
  onReceiptReceivedAtTextChange,
  onSupplierChange,
  onSupplierDocumentNoChange,
  onProductChange,
  onQuantityChange,
  onMoneyLineChange,
  onAddLine,
  onRemoveLine,
  onRollLengthTextsChange,
  onUpdateRollPayload,
  onUpdateSheetPayload,
  onAddSheetGroup,
  onRemoveSheetGroup,
  onDiscountChange,
  onPaidAmountChange,
  onNotesChange,
  onPaymentMethodChange,
  onFinanceAccountChange,
  onSave,
}: {
  ariaLabel: string
  form: PurchaseReceiptInput
  isReadOnly: boolean
  products: PurchaseReceiptProduct[]
  suppliers: Supplier[]
  receiptReceivedAtText: string
  rollLengthTexts: Record<number, string>
  totals: { subtotal: number; payable: number; remaining: number }
  lowCostWarnings: string[]
  editingId: string | null
  editingStatus: string | null
  paymentMethod: 'cash' | 'bank_transfer'
  financeAccountId: string
  bankAccounts: PurchaseReceiptFinanceAccount[]
  saving: boolean
  onReceiptReceivedAtTextChange: (value: string) => void
  onSupplierChange: (supplierId: string) => void
  onSupplierDocumentNoChange: (value: string) => void
  onProductChange: (index: number, productId: string) => void
  onQuantityChange: (index: number, quantity: number) => void
  onMoneyLineChange: (index: number, key: 'unit_cost' | 'discount_amount', value: string) => void
  onAddLine: () => void
  onRemoveLine: (index: number) => void
  onRollLengthTextsChange: (index: number, text: string) => void
  onUpdateRollPayload: (index: number, patch: { width_m?: number; lengths_m?: number[] }) => void
  onUpdateSheetPayload: (index: number, groupIndex: number, patch: Partial<SheetGroup>) => void
  onAddSheetGroup: (index: number) => void
  onRemoveSheetGroup: (index: number, groupIndex: number) => void
  onDiscountChange: (value: string) => void
  onPaidAmountChange: (value: string) => void
  onNotesChange: (value: string) => void
  onPaymentMethodChange: (method: 'cash' | 'bank_transfer') => void
  onFinanceAccountChange: (accountId: string) => void
  onSave: (event: FormEvent<HTMLFormElement>) => void
}) {
  const moneyInputValue = (value: number) => (Number.isFinite(value) ? money(value) : '')
  return (
    <ManagementDetailSection ariaLabel={ariaLabel}>
      <form aria-label="Thông tin phiếu nhập" className="purchase-receipt-form" onSubmit={onSave}>
        <label>
          Nhà cung cấp
          <select required disabled={isReadOnly} value={form.supplier_id} onChange={(event) => onSupplierChange(event.target.value)}>
            <option value="">Chọn NCC</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} - {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Thời gian nhập
          <input required disabled={isReadOnly} type="text" value={receiptReceivedAtText} onChange={(event) => onReceiptReceivedAtTextChange(event.target.value)} />
        </label>
        <label>
          Số chứng từ NCC
          <input readOnly={isReadOnly} value={form.supplier_document_no} onChange={(event) => onSupplierDocumentNoChange(event.target.value)} />
        </label>
        <div className="receipt-lines">
          {form.items.map((line, index) => (
            <fieldset key={index}>
              <legend>Dòng {index + 1}</legend>
              <label>
                Sản phẩm dòng {index + 1}
                <select required disabled={isReadOnly} value={line.product_id} onChange={(event) => onProductChange(index, event.target.value)}>
                  <option value="">Chọn hàng</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.code} - {product.name} ({product.inventory_shape === 'roll' ? 'cuộn' : product.inventory_shape === 'sheet' ? 'tấm' : 'thường'})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Đơn vị dòng {index + 1}
                <input readOnly disabled={isReadOnly} value={line.unit_name} />
              </label>
              <label>
                Số lượng dòng {index + 1}
                <input min="0.000001" step="0.000001" type="number" readOnly={isReadOnly || line.inventory_shape !== 'normal'} value={line.quantity} onChange={(event) => onQuantityChange(index, Number(event.target.value))} />
              </label>
              {line.inventory_shape === 'roll' ? (
                <div className="receipt-physical-box" aria-label={`Thông tin cuộn dòng ${index + 1}`}>
                  {(() => {
                    const payload = rollPayload(line.physical_payload)
                    const firstLength = payload.rolls.lengths_m[0] ?? 1
                    return (
                      <>
                        <label>
                          Khổ rộng cuộn dòng {index + 1}
                          <input min="0.001" step="0.001" type="number" readOnly={isReadOnly} value={payload.rolls.width_m} onChange={(event) => onUpdateRollPayload(index, { width_m: Number(event.target.value) })} />
                        </label>
                        <label>
                          Số cuộn cùng quy cách dòng {index + 1}
                          <input
                            min="1"
                            step="1"
                            type="number"
                            readOnly={isReadOnly}
                            value={payload.rolls.lengths_m.length}
                            onChange={(event) => {
                              const count = Math.max(Math.floor(Number(event.target.value) || 0), 0)
                              const lengths = Array.from({ length: count }, () => firstLength || 1)
                              onRollLengthTextsChange(index, lengths.join(', '))
                              onUpdateRollPayload(index, { lengths_m: lengths })
                            }}
                          />
                        </label>
                        <label>
                          Chiều dài mỗi cuộn dòng {index + 1}
                          <input
                            min="0.001"
                            step="0.001"
                            type="number"
                            readOnly={isReadOnly}
                            value={firstLength}
                            onChange={(event) => {
                              const length = Number(event.target.value)
                              const lengths = payload.rolls.lengths_m.map(() => length)
                              onRollLengthTextsChange(index, lengths.join(', '))
                              onUpdateRollPayload(index, { lengths_m: lengths })
                            }}
                          />
                        </label>
                        <label>
                          Chiều dài từng cuộn dòng {index + 1}
                          <textarea
                            readOnly={isReadOnly}
                            value={rollLengthTexts[index] ?? payload.rolls.lengths_m.join(', ')}
                            onChange={(event) => {
                              const text = event.target.value
                              onRollLengthTextsChange(index, text)
                              const lengths = text
                                .split(',')
                                .map((value) => Number(value.trim()))
                                .filter((value) => Number.isFinite(value) && value > 0)
                              onUpdateRollPayload(index, { lengths_m: lengths })
                            }}
                          />
                        </label>
                        <p className="physical-summary">{physicalSummary(line)}</p>
                      </>
                    )
                  })()}
                </div>
              ) : null}
              {line.inventory_shape === 'sheet' ? (
                <div className="receipt-physical-box" aria-label={`Thông tin tấm dòng ${index + 1}`}>
                  {sheetPayload(line.physical_payload).sheet_groups.map((group, groupIndex) => (
                    <fieldset key={groupIndex}>
                      <legend>Nhóm tấm {groupIndex + 1}</legend>
                      <label>
                        Rộng nhóm {groupIndex + 1} dòng {index + 1}
                        <input min="0.001" step="0.001" type="number" readOnly={isReadOnly} value={group.width_m} onChange={(event) => onUpdateSheetPayload(index, groupIndex, { width_m: Number(event.target.value) })} />
                      </label>
                      <label>
                        Dài nhóm {groupIndex + 1} dòng {index + 1}
                        <input min="0.001" step="0.001" type="number" readOnly={isReadOnly} value={group.length_m} onChange={(event) => onUpdateSheetPayload(index, groupIndex, { length_m: Number(event.target.value) })} />
                      </label>
                      <label>
                        Số tấm nhóm {groupIndex + 1} dòng {index + 1}
                        <input min="1" step="1" type="number" readOnly={isReadOnly} value={group.quantity} onChange={(event) => onUpdateSheetPayload(index, groupIndex, { quantity: Math.max(Math.floor(Number(event.target.value) || 0), 0) })} />
                      </label>
                      {isReadOnly ? null : (
                        <button className="button button-danger" type="button" onClick={() => onRemoveSheetGroup(index, groupIndex)}>
                          <Trash2 aria-hidden="true" size={15} />
                          Xóa nhóm tấm {groupIndex + 1}
                        </button>
                      )}
                    </fieldset>
                  ))}
                  <p className="physical-summary">{physicalSummary(line)}</p>
                  {isReadOnly ? null : (
                    <button className="button button-secondary" type="button" onClick={() => onAddSheetGroup(index)}>
                      <Plus aria-hidden="true" size={15} />
                      Thêm nhóm kích thước
                    </button>
                  )}
                </div>
              ) : null}
              <label>
                Đơn giá dòng {index + 1}
                <input inputMode="numeric" type="text" readOnly={isReadOnly} value={moneyInputValue(line.unit_cost)} onChange={(event) => onMoneyLineChange(index, 'unit_cost', event.target.value)} />
              </label>
              <label>
                Giảm giá dòng {index + 1}
                <input inputMode="numeric" type="text" readOnly={isReadOnly} value={moneyInputValue(line.discount_amount)} onChange={(event) => onMoneyLineChange(index, 'discount_amount', event.target.value)} />
              </label>
              <p>Thành tiền: {money(lineAmount(line))}</p>
              {isReadOnly ? null : (
                <button className="button button-danger" type="button" onClick={() => onRemoveLine(index)}>
                  <Trash2 aria-hidden="true" size={15} />
                  Xóa dòng
                </button>
              )}
            </fieldset>
          ))}
          {isReadOnly ? null : (
            <button className="button button-secondary" type="button" onClick={onAddLine}>
              <Plus aria-hidden="true" size={15} />
              Thêm dòng
            </button>
          )}
        </div>
        <label>
          Giảm giá phiếu
          <input inputMode="numeric" type="text" readOnly={isReadOnly} value={moneyInputValue(form.discount_amount)} onChange={(event) => onDiscountChange(event.target.value)} />
        </label>
        <label>
          Đã trả tạm
          <input inputMode="numeric" type="text" readOnly={isReadOnly} value={moneyInputValue(form.paid_amount)} onChange={(event) => onPaidAmountChange(event.target.value)} />
        </label>
        <label>
          Ghi chú
          <textarea readOnly={isReadOnly} value={form.notes} onChange={(event) => onNotesChange(event.target.value)} />
        </label>
        <div className="receipt-total-box">
          <p>Tổng tiền hàng: {money(totals.subtotal)}</p>
          <p>Cần trả NCC: {money(totals.payable)}</p>
          <p>Còn phải trả: {money(totals.remaining)}</p>
        </div>
        {lowCostWarnings.length > 0 ? (
          <div role="alert" className="receipt-warning-box">
            {lowCostWarnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        ) : null}
        {editingId !== null && editingStatus === 'draft' && Number(form.paid_amount || 0) > 0 ? (
          <div className="receipt-payment-box">
            <label>
              Phương thức trả ngay
              <select value={paymentMethod} onChange={(event) => onPaymentMethodChange(event.target.value as 'cash' | 'bank_transfer')}>
                <option value="cash">Tiền mặt</option>
                <option value="bank_transfer">Chuyển khoản</option>
              </select>
            </label>
            {paymentMethod === 'bank_transfer' ? (
              <label>
                Tài khoản chuyển khoản
                <select value={financeAccountId} onChange={(event) => onFinanceAccountChange(event.target.value)}>
                  <option value="">Chọn tài khoản</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{financeAccountChoiceLabel(account)}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}
        {isReadOnly ? null : (
          <button className="button button-secondary" disabled={saving} type="submit">
            <Save aria-hidden="true" size={16} />
            Lưu draft phiếu nhập
          </button>
        )}
      </form>
    </ManagementDetailSection>
  )
}
