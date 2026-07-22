import { ChevronLeft, ChevronRight, PackageCheck, Plus, Save, Search, Trash2, X } from 'lucide-react'
import type { FormEvent, RefObject } from 'react'
import type { ManagementSearchSuggestion } from '../../components/ui-shell/management-layout'
import {
  ManagementCompactSearch,
  ManagementDropdownField,
} from '../../components/ui-shell/management-layout'
import { ManagementLoadingOverlay } from '../../components/ui-shell/primitives'
import { parseMoneyInput } from '../../lib/number-format'
import type { CurrentUserData } from '../../lib/api/types'
import { financeAccountChoiceLabel } from '../finance/finance-presenter'
import {
  lineAmount,
  physicalSummary,
  rollPayload,
  sheetPayload,
} from './purchase-receipt-calculations'
import { money } from './purchase-receipt-presenter'
import type {
  PurchaseReceiptFinanceAccount,
  PurchaseReceiptInput,
  PurchaseReceiptProduct,
  SheetPhysicalPayload,
} from './purchase-receipt-types'
import type { SupplierInput } from './supplier-service'
import type { Supplier } from './types'
import { purchaseReceiptLineUnitChoices, type PurchaseReceiptUnitChoice } from './purchase-receipt-unit-choices'

type PaymentMethod = 'cash' | 'bank_transfer'
type ReceiptLine = PurchaseReceiptInput['items'][number]
type SheetGroup = SheetPhysicalPayload['sheet_groups'][number]

function accountDisplayName(currentUser?: CurrentUserData) {
  if (!currentUser) return ''
  return currentUser.user.display_name.trim() || currentUser.user.email
}

function moneyInputValue(value: number) {
  return Number.isFinite(value) ? money(value) : ''
}

export function PurchaseReceiptCreateWorkspace({
  bankAccounts,
  currentUser,
  financeAccountId,
  form,
  lowCostWarnings,
  paymentMethod,
  posting,
  products,
  receiptDebtEffect,
  receiptPaidAmountInputRef,
  receiptReceivedAtText,
  receiptSupplierCreateForm,
  receiptSupplierCreateOpen,
  receiptSupplierCreateSaving,
  receiptSupplierSearch,
  receiptSupplierSearchActive,
  receiptSupplierSearchInputRef,
  receiptSupplierSearchRef,
  receiptSupplierSearchResults,
  receiptSupplierSuggestions,
  receiptWorkspaceLookupLoading,
  receiptWorkspaceSideCollapsed,
  rollLengthTexts,
  saving,
  selectedFormSupplier,
  totals,
  onAddSheetGroup,
  onChangeImmediatePaymentMethod,
  onChangeReceiptSupplierSearch,
  onChooseReceiptSupplier,
  onClearReceiptSupplier,
  onCloseReceiptSupplierCreate,
  onCompleteNewReceipt,
  onCreateReceiptSupplier,
  onDiscountAmountChange,
  onFinanceAccountChange,
  onNotesChange,
  onOpenReceiptSupplierCreate,
  onPaidAmountChange,
  onReceiptCodeChange,
  onReceiptReceivedAtTextChange,
  onReceiptSupplierCreateFormChange,
  onRemoveLine,
  onRemoveSheetGroup,
  onRollLengthTextsChange,
  onSaveReceipt,
  onSetReceiptSupplierSuggestionsOpen,
  onSetReceiptWorkspaceSideCollapsed,
  onSupplierDocumentNoChange,
  onUpdateLine,
  onUpdateLineUnit,
  onUpdateMoneyLine,
  onUpdateRollPayload,
  onUpdateSheetPayload,
}: {
  bankAccounts: PurchaseReceiptFinanceAccount[]
  currentUser?: CurrentUserData
  financeAccountId: string
  form: PurchaseReceiptInput
  lowCostWarnings: string[]
  paymentMethod: PaymentMethod
  posting: boolean
  products: PurchaseReceiptProduct[]
  receiptDebtEffect: number
  receiptPaidAmountInputRef: RefObject<HTMLInputElement | null>
  receiptReceivedAtText: string
  receiptSupplierCreateForm: SupplierInput
  receiptSupplierCreateOpen: boolean
  receiptSupplierCreateSaving: boolean
  receiptSupplierSearch: string
  receiptSupplierSearchActive: boolean
  receiptSupplierSearchInputRef: RefObject<HTMLInputElement | null>
  receiptSupplierSearchRef: RefObject<HTMLDivElement | null>
  receiptSupplierSearchResults: Supplier[]
  receiptSupplierSuggestions?: ManagementSearchSuggestion[]
  receiptWorkspaceLookupLoading: boolean
  receiptWorkspaceSideCollapsed: boolean
  rollLengthTexts: Record<number, string>
  saving: boolean
  selectedFormSupplier?: Supplier | null
  totals: { subtotal: number; payable: number }
  onAddSheetGroup: (index: number) => void
  onChangeImmediatePaymentMethod: (method: PaymentMethod) => void
  onChangeReceiptSupplierSearch: (nextSearch: string) => void
  onChooseReceiptSupplier: (supplier: Supplier) => void
  onClearReceiptSupplier: () => void
  onCloseReceiptSupplierCreate: () => void
  onCompleteNewReceipt: () => void
  onCreateReceiptSupplier: (event: FormEvent<HTMLFormElement>) => void
  onDiscountAmountChange: (value: number) => void
  onFinanceAccountChange: (accountId: string) => void
  onNotesChange: (notes: string) => void
  onOpenReceiptSupplierCreate: () => void
  onPaidAmountChange: (value: number) => void
  onReceiptCodeChange: (code: string) => void
  onReceiptReceivedAtTextChange: (value: string) => void
  onReceiptSupplierCreateFormChange: (patch: Partial<SupplierInput>) => void
  onRemoveLine: (index: number) => void
  onRemoveSheetGroup: (lineIndex: number, groupIndex: number) => void
  onRollLengthTextsChange: (index: number, text: string) => void
  onSaveReceipt: (event: FormEvent<HTMLFormElement>) => void
  onSetReceiptSupplierSuggestionsOpen: (open: boolean) => void
  onSetReceiptWorkspaceSideCollapsed: (collapsed: boolean) => void
  onSupplierDocumentNoChange: (value: string) => void
  onUpdateLine: (index: number, patch: Partial<ReceiptLine>) => void
  onUpdateLineUnit: (index: number, unitName: string, unitChoices: PurchaseReceiptUnitChoice[]) => void
  onUpdateMoneyLine: (index: number, key: 'unit_cost' | 'discount_amount', value: string) => void
  onUpdateRollPayload: (index: number, patch: { width_m?: number; lengths_m?: number[] }) => void
  onUpdateSheetPayload: (index: number, groupIndex: number, patch: Partial<SheetGroup>) => void
}) {
  return (
    <section aria-label="Tạo phiếu nhập" className="purchase-receipt-workspace" role="region">
      <form
        aria-label="Thông tin phiếu nhập"
        className={`purchase-receipt-workspace-form${receiptWorkspaceSideCollapsed ? ' purchase-receipt-workspace-form-side-collapsed' : ''}`}
        onSubmit={onSaveReceipt}
      >
        <div className="purchase-receipt-workspace-main">
          {receiptWorkspaceLookupLoading ? <ManagementLoadingOverlay label="Đang tải dữ liệu phiếu nhập..." /> : null}
          <div className="management-table-viewport purchase-receipt-workspace-table-wrap">
            {form.items.length === 0 ? null : (
              <ul aria-label="Dòng hàng phiếu nhập mới" className="pos-cart-lines purchase-receipt-line-cards">
                <li aria-label="Cột dòng hàng nhập" className="pos-cart-line-heading purchase-receipt-line-heading">
                  <div className="pos-cart-line-header pos-cart-line-header-static purchase-receipt-line-card-header">
                    <span>STT</span>
                    <span>Tên hàng</span>
                    <span className="pos-cart-line-area-header purchase-receipt-quantity-header">
                      <span aria-hidden="true" />
                      <span>SL</span>
                    </span>
                    <span aria-hidden="true" />
                    <span>ĐVT</span>
                    <span>Đơn giá</span>
                    <span>Giảm giá</span>
                    <span>Thành tiền</span>
                  </div>
                </li>
                {form.items.map((line, index) => {
                  const selectedProduct = products.find((product) => product.id === line.product_id)
                  const unitOptions = purchaseReceiptLineUnitChoices(selectedProduct, products)
                  return (
                    <li
                      key={`${line.product_id || 'line'}-${index}`}
                      aria-label={`Dòng hàng nhập ${index + 1}`}
                      className="pos-cart-line-shell purchase-receipt-line-card"
                    >
                      <div className="pos-cart-line purchase-receipt-line-card-row">
                        <span className="pos-cart-line-index">{index + 1}</span>
                        <div className="pos-cart-line-name">
                          <strong>{selectedProduct?.name ?? 'Hàng hóa'}</strong>
                          <span>{selectedProduct?.code ?? line.product_id}</span>
                        </div>
                        <div className="pos-cart-line-quantity">
                          <input
                            aria-label={`Số lượng dòng ${index + 1}`}
                            inputMode="decimal"
                            readOnly={line.inventory_shape !== 'normal'}
                            type="text"
                            value={line.quantity}
                            onChange={(event) => onUpdateLine(index, { quantity: Number(event.target.value) })}
                          />
                        </div>
                        <span className="pos-cart-line-equals" aria-hidden="true" />
                        {unitOptions.length > 1 ? (
                          <select
                            aria-label={`Đơn vị dòng ${index + 1}`}
                            className="pos-cart-line-unit-select"
                            value={line.unit_name}
                            onChange={(event) => onUpdateLineUnit(index, event.target.value, unitOptions)}
                          >
                            {unitOptions.map((choice) => (
                              <option key={`${choice.unitName}-${choice.product?.id ?? 'unit'}`} value={choice.unitName}>{choice.unitName}</option>
                            ))}
                          </select>
                        ) : (
                          <input aria-label={`Đơn vị dòng ${index + 1}`} className="pos-cart-line-unit-select" readOnly value={line.unit_name} />
                        )}
                        <div className="pos-cart-line-price">
                          <input
                            aria-label={`Đơn giá dòng ${index + 1}`}
                            inputMode="numeric"
                            type="text"
                            value={moneyInputValue(line.unit_cost)}
                            onChange={(event) => onUpdateMoneyLine(index, 'unit_cost', event.target.value)}
                          />
                        </div>
                        <div className="pos-cart-line-price purchase-receipt-line-discount">
                          <input
                            aria-label={`Giảm giá dòng ${index + 1}`}
                            inputMode="numeric"
                            type="text"
                            value={moneyInputValue(line.discount_amount)}
                            onChange={(event) => onUpdateMoneyLine(index, 'discount_amount', event.target.value)}
                          />
                        </div>
                        <strong className="pos-cart-line-total">{money(lineAmount(line))}</strong>
                      </div>
                      <button
                        aria-label={`Xóa dòng ${index + 1}`}
                        className="pos-cart-line-remove"
                        type="button"
                        onClick={() => onRemoveLine(index)}
                      >
                        ×
                      </button>
                      {line.inventory_shape === 'roll' ? (() => {
                        const payload = rollPayload(line.physical_payload)
                        const firstLength = payload.rolls.lengths_m[0] ?? 1
                        return (
                          <div className="receipt-physical-box purchase-receipt-line-physical" aria-label={`Thông tin cuộn dòng ${index + 1}`}>
                            <label>
                              Khổ rộng cuộn dòng {index + 1}
                              <input
                                min="0.001"
                                step="0.001"
                                type="number"
                                value={payload.rolls.width_m}
                                onChange={(event) => onUpdateRollPayload(index, { width_m: Number(event.target.value) })}
                              />
                            </label>
                            <label>
                              Số cuộn cùng quy cách dòng {index + 1}
                              <input
                                min="1"
                                step="1"
                                type="number"
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
                          </div>
                        )
                      })() : null}
                      {line.inventory_shape === 'sheet' ? (
                        <div className="receipt-physical-box purchase-receipt-line-physical" aria-label={`Thông tin tấm dòng ${index + 1}`}>
                          {sheetPayload(line.physical_payload).sheet_groups.map((group, groupIndex) => (
                            <fieldset key={groupIndex}>
                              <legend>Nhóm tấm {groupIndex + 1}</legend>
                              <label>
                                Rộng nhóm {groupIndex + 1} dòng {index + 1}
                                <input
                                  min="0.001"
                                  step="0.001"
                                  type="number"
                                  value={group.width_m}
                                  onChange={(event) => onUpdateSheetPayload(index, groupIndex, { width_m: Number(event.target.value) })}
                                />
                              </label>
                              <label>
                                Dài nhóm {groupIndex + 1} dòng {index + 1}
                                <input
                                  min="0.001"
                                  step="0.001"
                                  type="number"
                                  value={group.length_m}
                                  onChange={(event) => onUpdateSheetPayload(index, groupIndex, { length_m: Number(event.target.value) })}
                                />
                              </label>
                              <label>
                                Số tấm nhóm {groupIndex + 1} dòng {index + 1}
                                <input
                                  min="1"
                                  step="1"
                                  type="number"
                                  value={group.quantity}
                                  onChange={(event) => onUpdateSheetPayload(index, groupIndex, { quantity: Math.max(Math.floor(Number(event.target.value) || 0), 0) })}
                                />
                              </label>
                              <button className="button button-danger" type="button" onClick={() => onRemoveSheetGroup(index, groupIndex)}>
                                <Trash2 aria-hidden="true" size={15} />
                                Xóa nhóm tấm {groupIndex + 1}
                              </button>
                            </fieldset>
                          ))}
                          <p className="physical-summary">{physicalSummary(line)}</p>
                          <button className="button button-secondary" type="button" onClick={() => onAddSheetGroup(index)}>
                            <Plus aria-hidden="true" size={15} />
                            Thêm nhóm kích thước
                          </button>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {receiptWorkspaceSideCollapsed ? (
          <div className="management-filter-rail purchase-receipt-workspace-side-rail">
            <button
              aria-label="Mở thông tin phiếu nhập"
              className="management-filter-expand-button"
              type="button"
              onClick={() => onSetReceiptWorkspaceSideCollapsed(false)}
            >
              <ChevronLeft aria-hidden="true" size={18} />
            </button>
          </div>
        ) : (
          <aside className="management-filter-sidebar purchase-receipt-workspace-side" aria-label="Thông tin phiếu nhập bên phải">
            <button
              aria-label="Ẩn thông tin phiếu nhập"
              className="management-filter-collapse-button"
              type="button"
              onClick={() => onSetReceiptWorkspaceSideCollapsed(true)}
            >
              <ChevronRight aria-hidden="true" size={18} />
            </button>
            <div className="purchase-receipt-workspace-side-body">
              <div className="purchase-receipt-workspace-side-top-row">
                <div className="purchase-receipt-workspace-account-field" aria-label="Tài khoản">
                  <div className="purchase-receipt-workspace-account-display">{accountDisplayName(currentUser)}</div>
                </div>
                <div className="purchase-receipt-workspace-time-field">
                  <input
                    aria-label="Thời gian nhập"
                    required
                    type="text"
                    value={receiptReceivedAtText}
                    onChange={(event) => onReceiptReceivedAtTextChange(event.target.value)}
                  />
                </div>
              </div>
              <div className="purchase-receipt-supplier-field" ref={receiptSupplierSearchRef}>
                {selectedFormSupplier && !receiptSupplierSearchActive ? (
                  <div aria-label="Nhà cung cấp đã chọn" className="customer-selected purchase-receipt-supplier-selected" role="group">
                    <span className="customer-selected-row">
                      <span className="customer-selected-chip">
                        <button
                          aria-label={`Nhà cung cấp ${selectedFormSupplier.name}`}
                          className="customer-selected-open"
                          type="button"
                        >
                          <span className="customer-selected-name">{selectedFormSupplier.name}</span>
                        </button>
                        <button
                          aria-label={`Bỏ nhà cung cấp ${selectedFormSupplier.name}`}
                          className="customer-selected-clear"
                          title="Bỏ nhà cung cấp"
                          type="button"
                          onClick={onClearReceiptSupplier}
                        >
                          <X aria-hidden="true" size={14} />
                        </button>
                      </span>
                      <span aria-label={`Mã nhà cung cấp ${selectedFormSupplier.code}`} className="customer-selected-group">
                        {selectedFormSupplier.code}
                      </span>
                    </span>
                    {selectedFormSupplier.phone ? (
                      <span className="purchase-receipt-supplier-selected-meta">
                        ĐT: <strong>{selectedFormSupplier.phone}</strong>
                      </span>
                    ) : null}
                    {Number(selectedFormSupplier.current_payable_amount || 0) !== 0 ? (
                      <span className="customer-selected-debt">
                        Cần trả:{' '}
                        <strong>{money(Math.abs(selectedFormSupplier.current_payable_amount))}</strong>
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <ManagementCompactSearch
                    label="Nhà cung cấp"
                    placeholder="Tìm NCC theo mã hoặc tên"
                    value={receiptSupplierSearch}
                    inputRef={receiptSupplierSearchInputRef}
                    leadingIcon={<Search aria-hidden="true" size={16} />}
                    trailingAction={(
                      <button
                        aria-label="Thêm nhanh NCC"
                        className="management-compact-create-action"
                        title="Thêm nhanh NCC"
                        type="button"
                        onClick={onOpenReceiptSupplierCreate}
                      >
                        <Plus aria-hidden="true" size={18} strokeWidth={2} />
                      </button>
                    )}
                    suggestions={receiptSupplierSuggestions}
                    suggestionsLabel="Gợi ý nhà cung cấp"
                    emptySuggestion="Không có NCC phù hợp"
                    selectFirstSuggestionOnEnter
                    onFocus={() => {
                      onSetReceiptSupplierSuggestionsOpen(true)
                    }}
                    onChange={onChangeReceiptSupplierSearch}
                    onSuggestionSelect={(suggestion) => {
                      const supplier = receiptSupplierSearchResults.find((item) => item.id === suggestion.id)
                      if (supplier) onChooseReceiptSupplier(supplier)
                    }}
                  />
                )}
              </div>
              <div className="management-modal-form-grid">
                <label>
                  Mã phiếu nhập
                  <input
                    placeholder="Mã phiếu tự động"
                    value={form.code}
                    onChange={(event) => onReceiptCodeChange(event.target.value)}
                  />
                </label>
              </div>
              <label>
                Trạng thái
                <input aria-label="Trạng thái phiếu nhập" readOnly value="Phiếu tạm" />
              </label>
              <label>
                Số hóa đơn đầu vào
                <input
                  value={form.supplier_document_no}
                  onChange={(event) => onSupplierDocumentNoChange(event.target.value)}
                />
              </label>
              <dl className="management-money-summary management-money-summary-compact">
                <div className="management-money-summary-row-stacked management-money-summary-emphasis">
                  <dt>Tổng tiền hàng</dt>
                  <dd>{money(totals.subtotal)}</dd>
                </div>
                <div className="management-money-summary-row-stacked">
                  <dt>
                    <label htmlFor="purchase-receipt-discount-amount">Giảm giá</label>
                  </dt>
                  <dd>
                    <input
                      className="management-inline-money-input"
                      id="purchase-receipt-discount-amount"
                      inputMode="numeric"
                      type="text"
                      value={moneyInputValue(form.discount_amount)}
                      onChange={(event) => onDiscountAmountChange(parseMoneyInput(event.target.value))}
                    />
                  </dd>
                </div>
                <div className="management-money-summary-row-stacked management-money-summary-emphasis">
                  <dt>Cần trả nhà cung cấp</dt>
                  <dd>{money(totals.payable)}</dd>
                </div>
                <div className="management-money-summary-row-stacked">
                  <dt>
                    <label htmlFor="purchase-receipt-paid-amount">Tiền trả nhà cung cấp (F8)</label>
                  </dt>
                  <dd>
                    <input
                      className="management-inline-money-input"
                      id="purchase-receipt-paid-amount"
                      ref={receiptPaidAmountInputRef}
                      inputMode="numeric"
                      type="text"
                      value={moneyInputValue(form.paid_amount)}
                      onChange={(event) => onPaidAmountChange(parseMoneyInput(event.target.value))}
                    />
                  </dd>
                </div>
                <div className="management-money-summary-control-stacked">
                  <dt>Phương thức</dt>
                  <dd>
                    <ManagementDropdownField
                      className="management-dropdown-field-inline"
                      label="Phương thức"
                      menuLabel="Chọn phương thức"
                      options={[
                        { value: 'cash', label: 'Tiền mặt' },
                        { value: 'bank_transfer', label: 'Chuyển khoản' },
                      ]}
                      value={paymentMethod}
                      onChange={(value) => onChangeImmediatePaymentMethod(value as PaymentMethod)}
                    />
                  </dd>
                </div>
                {paymentMethod === 'bank_transfer' ? (
                  <div className="management-money-summary-control-stacked">
                    <dt>Tài khoản</dt>
                    <dd>
                      <ManagementDropdownField
                        className="management-dropdown-field-inline"
                        label="Tài khoản"
                        menuLabel="Chọn tài khoản chuyển khoản"
                        options={[
                          { value: '', label: 'Chọn tài khoản' },
                          ...bankAccounts.map((account) => ({
                            value: account.id,
                            label: financeAccountChoiceLabel(account),
                          })),
                        ]}
                        value={financeAccountId}
                        onChange={onFinanceAccountChange}
                      />
                    </dd>
                  </div>
                ) : null}
                <div className="management-money-summary-final management-money-summary-emphasis management-money-summary-stacked">
                  <dt>Tính vào công nợ</dt>
                  <dd>{money(receiptDebtEffect)}</dd>
                </div>
              </dl>
              <label>
                Ghi chú
                <textarea
                  value={form.notes}
                  onChange={(event) => onNotesChange(event.target.value)}
                />
              </label>
              {lowCostWarnings.length > 0 ? (
                <div role="alert" className="receipt-warning-box">
                  {lowCostWarnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}
            </div>
            <footer className="management-filter-actions purchase-receipt-workspace-actions">
              <button className="button button-secondary" disabled={saving} type="submit">
                <Save aria-hidden="true" size={16} />
                Lưu tạm
              </button>
              <button className="button button-primary" disabled={saving || posting} type="button" onClick={onCompleteNewReceipt}>
                <PackageCheck aria-hidden="true" size={16} />
                Hoàn thành
              </button>
            </footer>
          </aside>
        )}
      </form>
      {receiptSupplierCreateOpen ? (
        <div className="management-modal-backdrop">
          <section aria-label="Thêm nhanh nhà cung cấp" className="management-modal-dialog management-modal-dialog-compact receipt-supplier-create-panel" role="dialog">
            <header className="management-modal-header">
              <div>
                <h2>Thêm nhanh NCC</h2>
              </div>
              <button aria-label="Đóng thêm nhanh NCC" className="management-modal-close" type="button" onClick={onCloseReceiptSupplierCreate}>
                ×
              </button>
            </header>
            <form aria-label="Thông tin thêm nhanh NCC" className="management-modal-form" onSubmit={onCreateReceiptSupplier}>
              <div className="management-modal-form-grid">
                <label>
                  Tên NCC
                  <input
                    required
                    value={receiptSupplierCreateForm.name}
                    onChange={(event) => onReceiptSupplierCreateFormChange({ name: event.target.value })}
                  />
                </label>
                <label>
                  Mã NCC
                  <input
                    placeholder="Mã tự động"
                    value={receiptSupplierCreateForm.code}
                    onChange={(event) => onReceiptSupplierCreateFormChange({ code: event.target.value })}
                  />
                </label>
                <label>
                  Điện thoại
                  <input
                    value={receiptSupplierCreateForm.phone}
                    onChange={(event) => onReceiptSupplierCreateFormChange({ phone: event.target.value })}
                  />
                </label>
                <label>
                  MST
                  <input
                    value={receiptSupplierCreateForm.tax_code}
                    onChange={(event) => onReceiptSupplierCreateFormChange({ tax_code: event.target.value })}
                  />
                </label>
                <label>
                  Email
                  <input
                    value={receiptSupplierCreateForm.email}
                    onChange={(event) => onReceiptSupplierCreateFormChange({ email: event.target.value })}
                  />
                </label>
                <label>
                  Địa chỉ
                  <input
                    value={receiptSupplierCreateForm.address}
                    onChange={(event) => onReceiptSupplierCreateFormChange({ address: event.target.value })}
                  />
                </label>
                <label className="management-modal-full-row">
                  Ghi chú
                  <textarea
                    value={receiptSupplierCreateForm.notes}
                    onChange={(event) => onReceiptSupplierCreateFormChange({ notes: event.target.value })}
                  />
                </label>
              </div>
              <footer className="management-modal-footer">
                <button className="button button-secondary" type="button" onClick={onCloseReceiptSupplierCreate}>
                  Bỏ qua
                </button>
                <button className="button button-primary" disabled={receiptSupplierCreateSaving} type="submit">
                  <Save aria-hidden="true" size={16} />
                  Lưu NCC
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  )
}
