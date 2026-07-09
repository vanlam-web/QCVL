import type { ReactNode, RefObject } from 'react'

interface PosPaymentPanelProps {
  checkoutOpen: boolean
  checkoutDrawerRef: RefObject<HTMLElement | null>
  main: ReactNode
  checkout: ReactNode
  onCloseCheckout: () => void
}

export function PosPaymentPanel({
  checkoutOpen,
  checkoutDrawerRef,
  main,
  checkout,
  onCloseCheckout,
}: PosPaymentPanelProps) {
  return (
    <>
      {!checkoutOpen ? (
        <section aria-label="K03 sản phẩm" className="pos-payment">
          {main}
        </section>
      ) : null}
      {checkoutOpen ? (
        <aside ref={checkoutDrawerRef} aria-label="Ngăn thanh toán" className="pos-checkout-drawer">
          <button
            aria-label="Đóng thanh toán"
            className="pos-checkout-drawer-close"
            type="button"
            onClick={onCloseCheckout}
          >
            ×
          </button>
          {checkout}
        </aside>
      ) : null}
    </>
  )
}
