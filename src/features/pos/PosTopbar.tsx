import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import { Clock3, PackageOpen, Plus, Search } from 'lucide-react'
import { ThemeToggle } from '../../components/ui-shell/ThemeProvider'
import type { CurrentUserData } from '../../lib/api/types'
import { formatMeasure, formatMoney } from '../../lib/number-format'
import type { Product, ResolvedPrice } from '../catalog/types'
import { displaySaleUnitName, maxInvoiceTabs, invoiceTabLabel, type PosInvoiceTab } from './pos-core'
import { ProfileMenu } from './ProfileMenu'

function productStockLine(product: Product) {
  const stock = product.operating_stock ?? product.kiotviet_provisional_stock
  if (!stock) return null
  return `Tồn: ${formatMeasure(stock.quantity)} ${stock.unit_name}`
}

interface PosTopbarProps {
  currentUser: CurrentUserData
  prices: Record<string, ResolvedPrice>
  productSearch: string
  productSearchRef: RefObject<HTMLInputElement | null>
  productSearchResults: Product[]
  tabs: PosInvoiceTab[]
  activeTabId: string
  onOpenDashboard: () => void
  onOpenAdmin: () => void
  onSignOut: () => void
  onProductSearchChange: (value: string) => void
  onProductSearchFocus: () => void
  onProductSearchKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void
  onProductSelect: (product: Product) => void
  onOpenProductCreate: () => void
  onCreateInvoiceTab: () => void
  onCloseInvoiceTab: (tabId: string) => void
  onSetActiveTab: (tabId: string) => void
  onOpenRecentInvoices: () => void
  onOpenManualMaterialOpening: () => void
}

export function PosTopbar({
  currentUser,
  prices,
  productSearch,
  productSearchRef,
  productSearchResults,
  tabs,
  activeTabId,
  onOpenDashboard,
  onOpenAdmin,
  onSignOut,
  onProductSearchChange,
  onProductSearchFocus,
  onProductSearchKeyDown,
  onProductSelect,
  onOpenProductCreate,
  onCreateInvoiceTab,
  onCloseInvoiceTab,
  onSetActiveTab,
  onOpenRecentInvoices,
  onOpenManualMaterialOpening,
}: PosTopbarProps) {
  const hasProductSearch = productSearch.trim().length > 0
  const [searchResultsWanted, setSearchResultsWanted] = useState(false)
  const searchResultsOpen = hasProductSearch && searchResultsWanted
  const searchRootRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!searchResultsOpen) return undefined

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target
      if (target instanceof Node && searchRootRef.current?.contains(target)) return
      setSearchResultsWanted(false)
    }

    window.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [searchResultsOpen])

  return (
    <section aria-label="K01 topbar" className="pos-topbar">
      <section ref={searchRootRef} aria-label="K01 tìm kiếm" className="pos-topbar-search">
        <button
          aria-label="QC"
          className="pos-brand-button"
          type="button"
          onClick={onOpenDashboard}
        >
          <img alt="" className="pos-brand-logo" src="/brand-logo.png" />
        </button>
        <label className="management-compact-search pos-topbar-search-control">
          <span className="pos-topbar-search-label">Tìm hàng (F3)</span>
          <span className="management-compact-search-leading">
            <Search aria-hidden="true" size={16} />
          </span>
          <input
            ref={productSearchRef}
            value={productSearch}
            placeholder="Tìm hàng, combo, vật tư"
            onFocus={() => {
              setSearchResultsWanted(true)
              onProductSearchFocus()
            }}
            onChange={(event) => {
              setSearchResultsWanted(true)
              onProductSearchChange(event.target.value)
            }}
            onKeyDown={onProductSearchKeyDown}
          />
          <span className="management-compact-search-trailing">
            <button
              aria-label={hasProductSearch ? 'Xóa tìm kiếm' : 'Tạo hàng hóa'}
              className={`management-compact-create-action pos-search-add-button${hasProductSearch ? ' management-compact-create-action-clear' : ''}`}
              title={hasProductSearch ? 'Xóa tìm kiếm' : 'Tạo hàng hóa'}
              type="button"
              onClick={() => {
                if (hasProductSearch) {
                  setSearchResultsWanted(false)
                  onProductSearchChange('')
                  return
                }
                onOpenProductCreate()
              }}
            >
              <Plus aria-hidden="true" size={18} />
            </button>
          </span>
        </label>
        {hasProductSearch && searchResultsOpen ? (
          <ul aria-label="Kết quả tìm hàng" className="pos-search-results" role="listbox">
            {productSearchResults.length > 0 ? (
              productSearchResults.map((product) => {
                const price = prices[product.id]?.unit_price ?? 0
                const stockLine = productStockLine(product)
                return (
                  <li key={product.id}>
                    <button
                      className="pos-search-result"
                      role="option"
                      aria-selected="false"
                      aria-label={`Chọn ${product.code} ${product.name}`}
                      type="button"
                      onClick={() => onProductSelect(product)}
                    >
                      <span className="pos-search-result-main">
                        <span className="pos-search-result-title">
                          <strong>{product.name}</strong>
                          <span className="pos-search-result-unit">{displaySaleUnitName(product.unit_name)}</span>
                        </span>
                        <span className="pos-search-result-code">{product.code}</span>
                        {stockLine ? <span className="pos-search-result-stock">{stockLine}</span> : null}
                      </span>
                      <span className="pos-search-result-price">{formatMoney(price)}</span>
                    </button>
                  </li>
                )
              })
            ) : (
              <li role="option" aria-selected="false">Không tìm thấy hàng hóa phù hợp</li>
            )}
          </ul>
        ) : null}
      </section>
      <section aria-label="K01 tab hóa đơn" className="pos-topbar-tabs">
        {tabs.map((tab) => {
          const isActiveTab = tab.id === activeTabId
          return (
            <span
              key={tab.id}
              className="pos-invoice-tab"
              data-current={isActiveTab ? 'true' : undefined}
            >
              <button
                aria-current={isActiveTab ? 'true' : undefined}
                type="button"
                onClick={() => onSetActiveTab(tab.id)}
              >
                {invoiceTabLabel(tab, isActiveTab)}
              </button>
              {isActiveTab ? (
                <button
                  aria-label={`Đóng Hóa đơn ${tab.number}`}
                  className="pos-invoice-tab-close"
                  type="button"
                  onClick={() => onCloseInvoiceTab(tab.id)}
                >
                  ×
                </button>
              ) : null}
            </span>
          )
        })}
        <button
          aria-label="Tạo hóa đơn mới"
          disabled={tabs.length >= maxInvoiceTabs}
          title={tabs.length >= maxInvoiceTabs ? 'Đã đạt tối đa 10 hóa đơn đang mở' : undefined}
          type="button"
          onClick={onCreateInvoiceTab}
        >
          +
        </button>
      </section>
      <section aria-label="K01 tiện ích" className="pos-topbar-actions">
        <button
          aria-label="Khui vật tư"
          className="pos-icon-button"
          title="Khui vật tư"
          type="button"
          onClick={onOpenManualMaterialOpening}
        >
          <PackageOpen aria-hidden="true" size={18} />
        </button>
        <button aria-label="Lịch sử 10 đơn gần nhất" className="pos-icon-button" type="button" onClick={onOpenRecentInvoices}>
          <Clock3 aria-hidden="true" size={18} />
        </button>
        <div aria-label="Tài khoản và giao diện" className="shell-user-actions pos-user-actions">
          <ThemeToggle />
          <ProfileMenu
            displayName={currentUser.user.display_name}
            permissions={currentUser.permissions}
            compact
            onSignOut={onSignOut}
            onOpenAdmin={onOpenAdmin}
            onOpenDashboard={onOpenDashboard}
          />
        </div>
      </section>
    </section>
  )
}
