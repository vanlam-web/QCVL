import { useMemo, useState, type ReactNode } from 'react'
import type { Product, ResolvedPrice } from '../catalog/types'
import { formatMoney } from '../../lib/number-format'

const productsPerPage = 12

export function ProductGrid({
  products,
  prices,
  loading,
  onSelectProduct,
  footerAction,
}: {
  products: Product[]
  prices: Record<string, ResolvedPrice>
  loading: boolean
  onSelectProduct: (product: Product) => void
  footerAction?: ReactNode
}) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(products.length / productsPerPage))
  const safePage = Math.min(page, totalPages)
  const visibleProducts = useMemo(
    () => products.slice((safePage - 1) * productsPerPage, safePage * productsPerPage),
    [safePage, products],
  )

  if (loading) return <p>Đang tải sản phẩm...</p>
  if (products.length === 0) return <p>Chưa có sản phẩm đang bán.</p>

  return (
    <section aria-label="Sản phẩm nhanh" className="product-grid-panel">
      <div className="product-grid">
        {visibleProducts.map((product) => {
          const price = prices[product.id]?.unit_price ?? 0
          return (
            <button
              key={product.id}
              type="button"
              aria-label={`${product.name} ${formatMoney(price)}/${product.unit_name}`}
              onClick={() => onSelectProduct(product)}
            >
              <strong>{product.name}</strong>
              <span>{formatMoney(price)}/{product.unit_name}</span>
            </button>
          )
        })}
      </div>
      <footer className="product-grid-footer">
        <div className="product-grid-pagination" aria-label="Phân trang sản phẩm nhanh">
          <button
            aria-label="Trang trước sản phẩm nhanh"
            disabled={safePage === 1}
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            ‹
          </button>
          <span>{safePage}/{totalPages}</span>
          <button
            aria-label="Trang sau sản phẩm nhanh"
            disabled={safePage === totalPages}
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            ›
          </button>
        </div>
        {footerAction ? <div className="product-grid-footer-action">{footerAction}</div> : null}
      </footer>
    </section>
  )
}
