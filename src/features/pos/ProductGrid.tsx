import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Product, ResolvedPrice } from '../catalog/types'
import { formatMoney } from '../../lib/number-format'
import { posPriceWithUnitText } from './pos-core'

const fallbackGridMetrics = { columns: 2, rows: 5, pageSize: 10 }
const minProductCardHeightRem = 4.9
const threeColumnBreakpointPx = 420

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
  const [gridMetrics, setGridMetrics] = useState(fallbackGridMetrics)
  const gridRef = useRef<HTMLDivElement>(null)
  const totalPages = Math.max(1, Math.ceil(products.length / gridMetrics.pageSize))
  const safePage = Math.min(page, totalPages)
  const visibleProducts = useMemo(
    () => products.slice((safePage - 1) * gridMetrics.pageSize, safePage * gridMetrics.pageSize),
    [safePage, products, gridMetrics.pageSize],
  )
  const gridStyle = {
    '--product-grid-columns': gridMetrics.columns,
    '--product-grid-card-height': `${minProductCardHeightRem}rem`,
  } as CSSProperties

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (grid === null) return

    function measure(element: HTMLDivElement) {
      if (element.clientWidth === 0 || element.clientHeight === 0) return

      const style = getComputedStyle(element)
      const fontSize = Number.parseFloat(style.fontSize) || 16
      const rowGap = Number.parseFloat(style.rowGap) || 0
      const minCardHeight = minProductCardHeightRem * fontSize
      const columns = element.clientWidth >= threeColumnBreakpointPx ? 3 : 2
      const rows = Math.max(1, Math.floor((element.clientHeight + rowGap) / (minCardHeight + rowGap)))
      const pageSize = Math.max(1, columns * rows)
      setGridMetrics((current) => (
        current.columns === columns && current.rows === rows && current.pageSize === pageSize
          ? current
          : { columns, rows, pageSize }
      ))
    }

    measure(grid)
    const animationFrame = window.requestAnimationFrame(() => measure(grid))
    const timeout = window.setTimeout(() => measure(grid), 100)
    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => measure(grid)
      window.addEventListener('resize', handleResize)
      return () => {
        window.cancelAnimationFrame(animationFrame)
        window.clearTimeout(timeout)
        window.removeEventListener('resize', handleResize)
      }
    }

    const resizeObserver = new ResizeObserver(() => measure(grid))
    resizeObserver.observe(grid)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.clearTimeout(timeout)
      resizeObserver.disconnect()
    }
  }, [loading, products.length])

  if (loading) return <p>Đang tải sản phẩm...</p>
  if (products.length === 0) return <p>Chưa có sản phẩm đang bán.</p>

  return (
    <section aria-label="Sản phẩm nhanh" className="product-grid-panel">
      <div className="product-grid" ref={gridRef} style={gridStyle}>
        {visibleProducts.map((product) => {
          const price = prices[product.id]?.unit_price ?? 0
          const priceText = posPriceWithUnitText(formatMoney(price), product.unit_name)
          return (
            <button
              key={product.id}
              type="button"
              aria-label={`${product.code} ${product.name} ${priceText}`}
              onClick={() => onSelectProduct(product)}
            >
              <small>{product.code}</small>
              <strong>{product.name}</strong>
              <span>{priceText}</span>
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
