import { useEffect, useState } from 'react'
import { formatApiError } from '../../lib/api/error-message'
import { displayPriceListName } from '../../lib/price-list-display'
import { BillPrintToolbar } from './BillPrintToolbar'
import {
  isWalkInCustomerCode,
  listBillTemplatesForDocument,
  quoteFooterText,
  readOrganizationBillSettingsCache,
  resolveNamedPrintTemplate,
  resolvePreferredNamedTemplate,
  writeOrganizationBillSettingsCache,
  type OrganizationBillSettings,
} from './bill-settings'
import type { SalesDocumentService } from './sales-document-service'
import type { SalesDocumentDetail } from './types'
import {
  salesDocumentMeasureText,
  salesDocumentMoneyText,
  salesDocumentQuoteDateText,
  salesDocumentQuoteLineDimensionText,
} from './sales-document-presenter'

export function QuotePrintPage({
  documentId,
  service,
  onClose,
  initialTemplate,
  loadBillSettings,
  saveCustomerBillPreference,
}: {
  documentId: string
  service: SalesDocumentService
  onClose: () => void
  initialTemplate?: string | null
  loadBillSettings?: () => Promise<OrganizationBillSettings>
  saveCustomerBillPreference?: (customerId: string, template: string) => Promise<void>
}) {
  const [document, setDocument] = useState<SalesDocumentDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<OrganizationBillSettings>(() => readOrganizationBillSettingsCache())
  const [templateId, setTemplateId] = useState<string>(() =>
    resolvePreferredNamedTemplate({
      settings: readOrganizationBillSettingsCache(),
      documentType: 'quote',
      queryTemplate: initialTemplate,
    }).id,
  )
  const [preferenceStatus, setPreferenceStatus] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadDocument() {
      setError(null)
      setPreferenceStatus(null)
      try {
        const [result, remoteSettings] = await Promise.all([
          service.getSalesDocument(documentId),
          loadBillSettings ? loadBillSettings().catch(() => null) : Promise.resolve(null),
        ])
        if (!active) return
        setDocument(result)
        let nextSettings = readOrganizationBillSettingsCache()
        if (remoteSettings) {
          nextSettings = writeOrganizationBillSettingsCache(remoteSettings)
          setSettings(nextSettings)
        }
        setTemplateId(
          resolvePreferredNamedTemplate({
            settings: nextSettings,
            documentType: 'quote',
            queryTemplate: initialTemplate,
            customerCode: result.customer.code,
            preferredTemplate: result.customer.preferred_bill_template,
          }).id,
        )
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được báo giá.'))
      }
    }

    void loadDocument()

    return () => {
      active = false
    }
  }, [documentId, initialTemplate, loadBillSettings, service])

  async function handleTemplateSelect(nextId: string) {
    setTemplateId(nextId)
    setPreferenceStatus(null)
    const named = resolveNamedPrintTemplate(settings, 'quote', { templateId: nextId })
    const customer = document?.customer
    if (!customer?.id || isWalkInCustomerCode(customer.code) || !saveCustomerBillPreference) return
    try {
      await saveCustomerBillPreference(customer.id, named.id)
      setPreferenceStatus('Đã nhớ mẫu cho khách')
    } catch {
      setPreferenceStatus('Không lưu được mẫu cho khách')
    }
  }

  if (error) {
    return (
      <main className="quote-print-shell">
        <p role="alert">{error}</p>
        <button className="quote-print-control" type="button" onClick={onClose}>
          Đóng
        </button>
      </main>
    )
  }

  if (!document) {
    return (
      <main className="quote-print-shell">
        <p>Đang tải báo giá...</p>
      </main>
    )
  }

  if (document.order_type !== 'quote' || !document.code.startsWith('BG')) {
    return (
      <main className="quote-print-shell">
        <p role="alert">Chỉ in báo giá BG... trong màn này</p>
        <button className="quote-print-control" type="button" onClick={onClose}>
          Đóng
        </button>
      </main>
    )
  }

  const quoteTemplates = listBillTemplatesForDocument(settings, 'quote')
  const printContent = resolveNamedPrintTemplate(settings, 'quote', { templateId })
  const template = printContent.paper_size

  return (
    <main className={`quote-print-shell bill-template-${template}`}>
      <BillPrintToolbar
        templates={quoteTemplates}
        selectedTemplateId={printContent.id}
        onTemplateSelect={handleTemplateSelect}
        onPrint={() => window.print()}
        onClose={onClose}
        preferenceStatus={preferenceStatus}
      />

      <article className="quote-print-page" aria-label={`Báo giá ${document.code}`}>
        <header className="quote-print-heading">
          <div>
            {printContent.show_logo && settings.logo_data_url ? (
              <img alt="" className="quote-print-logo" src={settings.logo_data_url} />
            ) : null}
            <strong>{settings.shop_name}</strong>
            {printContent.show_shop_address && settings.shop_address ? <p>{settings.shop_address}</p> : null}
            {printContent.show_shop_phone && settings.shop_phone ? <p>ĐT: {settings.shop_phone}</p> : null}
            {printContent.header_note.trim() ? (
              <p className="quote-print-promo">{printContent.header_note}</p>
            ) : null}
          </div>
          <div>
            <h1>{printContent.title}</h1>
            <dl>
              <div>
                <dt>Mã</dt>
                <dd>{document.code}</dd>
              </div>
              <div>
                <dt>Ngày</dt>
                <dd>{salesDocumentQuoteDateText(document.created_at)}</dd>
              </div>
            </dl>
          </div>
        </header>

        <section className="quote-print-parties" aria-label="Thông tin báo giá">
          <dl>
            <div>
              <dt>Khách hàng</dt>
              <dd>{document.customer.name}</dd>
            </div>
            {printContent.show_customer_phone && document.customer.phone ? (
              <div>
                <dt>Điện thoại</dt>
                <dd>{document.customer.phone}</dd>
              </div>
            ) : null}
            {printContent.show_seller ? (
              <div>
                <dt>Nhân viên</dt>
                <dd>{document.seller.name}</dd>
              </div>
            ) : null}
            {printContent.show_price_list ? (
              <div>
                <dt>Bảng giá</dt>
                <dd>{displayPriceListName(document.price_list)}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <table aria-label="Dòng hàng báo giá" className="quote-print-lines">
          <thead>
            <tr>
              <th>STT</th>
              {printContent.show_product_code ? <th>Mã hàng</th> : null}
              <th>Nội dung</th>
              {printContent.show_unit ? <th>ĐVT</th> : null}
              <th>SL</th>
              <th>Đơn giá</th>
              {printContent.show_discount ? <th>CK</th> : null}
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {document.items.map((item) => {
              const dimension = salesDocumentQuoteLineDimensionText(item)
              return (
                <tr key={item.id}>
                  <td>{item.line_no}</td>
                  {printContent.show_product_code ? <td>{item.product.code}</td> : null}
                  <td>
                    <strong>{item.product.name}</strong>
                    {dimension ? <p>{dimension}</p> : null}
                    {item.note ? <p>{item.note}</p> : null}
                  </td>
                  {printContent.show_unit ? <td>{item.product.unit_name}</td> : null}
                  <td>{salesDocumentMeasureText(item.quantity)}</td>
                  <td>{salesDocumentMoneyText(item.unit_price)}</td>
                  {printContent.show_discount ? (
                    <td>{item.discount_amount > 0 ? salesDocumentMoneyText(item.discount_amount) : ''}</td>
                  ) : null}
                  <td>{salesDocumentMoneyText(item.line_total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <section className="quote-print-totals" aria-label="Tổng báo giá">
          <dl>
            <div>
              <dt>Tổng tiền hàng</dt>
              <dd>{salesDocumentMoneyText(document.subtotal_amount)}</dd>
            </div>
            <div>
              <dt>Giảm giá</dt>
              <dd>{salesDocumentMoneyText(document.discount_amount)}</dd>
            </div>
            <div>
              <dt>Tổng báo giá</dt>
              <dd>{salesDocumentMoneyText(document.total_amount)}</dd>
            </div>
          </dl>
        </section>

        {printContent.show_notes && document.note ? (
          <section className="quote-print-note" aria-label="Ghi chú">
            <h2>Ghi chú</h2>
            <p>{document.note}</p>
          </section>
        ) : null}

        {printContent.show_signatures ? (
          <section className="quote-print-signatures" aria-label="Chữ ký">
            <div>
              <p>Người bán</p>
              <span />
            </div>
            <div>
              <p>Khách hàng</p>
              <span />
            </div>
          </section>
        ) : null}

        <p className="quote-print-footnote">{quoteFooterText(printContent)}</p>
      </article>
    </main>
  )
}
