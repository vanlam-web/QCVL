import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'
import { PackageOpen, Plus, Search } from 'lucide-react'
import { ConnectionStatus } from '../../components/ConnectionStatus'
import { ThemeToggle } from '../../components/ui-shell/ThemeProvider'
import type { CurrentUserData } from '../../lib/api/types'
import { formatMoney } from '../../lib/number-format'
import type { Product, ResolvedPrice } from '../catalog/types'
import { maxInvoiceTabs, invoiceTabLabel, type PosInvoiceTab } from './pos-core'
import { ProfileMenu } from './ProfileMenu'

interface PosTopbarProps {
  connected: boolean
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
  onOpenManualMaterialOpening: () => void
}

export function PosTopbar({
  connected,
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
  onOpenManualMaterialOpening,
}: PosTopbarProps) {
  const hasProductSearch = productSearch.trim().length > 0

  return (
    <section aria-label="K01 topbar" className="pos-topbar">
      <section aria-label="K01 tìm kiếm" className="pos-topbar-search">
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
            onFocus={onProductSearchFocus}
            onChange={(event) => onProductSearchChange(event.target.value)}
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
        {hasProductSearch ? (
          <ul aria-label="Kết quả tìm hàng" className="pos-search-results" role="listbox">
            {productSearchResults.length > 0 ? (
              productSearchResults.map((product) => {
                const price = prices[product.id]?.unit_price ?? 0
                return (
                  <li key={product.id}>
                    <button
                      role="option"
                      aria-selected="false"
                      type="button"
                      onClick={() => onProductSelect(product)}
                    >
                      <strong>{product.code} {product.name}</strong>
                      <span>{product.unit_name}</span>
                      <span>{formatMoney(price)}</span>
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
        <button aria-label="Lịch sử 10 đơn gần nhất" className="pos-icon-button" type="button">
          🕒
        </button>
        <ConnectionStatus connected={connected} />
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
