import { useEffect, useState } from 'react'
import { formatApiError } from '../../lib/api/error-message'
import { displayPriceListName } from '../../lib/price-list-display'
import { BillPrintToolbar } from './BillPrintToolbar'
import {
  invoiceFooterText,
  isBillTemplateId,
  isWalkInCustomerCode,
  listBillTemplatesForDocument,
  readOrganizationBillSettingsCache,
  resolveBillTemplate,
  resolveNamedPrintTemplate,
  writeOrganizationBillSettingsCache,
  type BillTemplateId,
  type OrganizationBillSettings,
} from './bill-settings'
import type { SalesDocumentService } from './sales-document-service'
import type { SalesDocumentDetail } from './types'
import {
  salesDocumentLineDimensionText,
  salesDocumentMeasureText,
  salesDocumentMoneyText,
  salesDocumentQuoteDateText,
} from './sales-document-presenter'

export function InvoicePrintPage({
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
  saveCustomerBillPreference?: (customerId: string, template: BillTemplateId) => Promise<void>
}) {
  const [document, setDocument] = useState<SalesDocumentDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<OrganizationBillSettings>(() => readOrganizationBillSettingsCache())
  const [templateId, setTemplateId] = useState<string>(() => {
    const cached = readOrganizationBillSettingsCache()
    const paper = isBillTemplateId(initialTemplate) ? initialTemplate : cached.default_bill_template
    return resolveNamedPrintTemplate(cached, 'invoice', { paper }).id
  })
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
        const paper = resolveBillTemplate({
          queryTemplate: initialTemplate,
          customerCode: result.customer.code,
          preferredTemplate: result.customer.preferred_bill_template,
          orgDefault: nextSettings.default_bill_template,
        })
        setTemplateId(resolveNamedPrintTemplate(nextSettings, 'invoice', { paper }).id)
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được hóa đơn.'))
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
    const named = resolveNamedPrintTemplate(settings, 'invoice', { templateId: nextId })
    const customer = document?.customer
    if (!customer?.id || isWalkInCustomerCode(customer.code) || !saveCustomerBillPreference) return
    try {
      await saveCustomerBillPreference(customer.id, named.paper_size)
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
        <p>Đang tải hóa đơn...</p>
      </main>
    )
  }

  if (document.order_type !== 'invoice' || !document.code.startsWith('HD')) {
    return (
      <main className="quote-print-shell">
        <p role="alert">Chỉ in hóa đơn HD... trong màn này</p>
        <button className="quote-print-control" type="button" onClick={onClose}>
          Đóng
        </button>
      </main>
    )
  }

  const invoiceTemplates = listBillTemplatesForDocument(settings, 'invoice')
  const printContent = resolveNamedPrintTemplate(settings, 'invoice', { templateId })
  const template = printContent.paper_size
  const remainingDebt = Math.max(0, document.total_amount - document.paid_amount)
  const surplus = Math.max(0, document.paid_amount - document.total_amount)

  return (
    <main className={`quote-print-shell bill-template-${template}`}>
      <BillPrintToolbar
        templates={invoiceTemplates}
        selectedTemplateId={printContent.id}
        onTemplateSelect={handleTemplateSelect}
        onPrint={() => window.print()}
        onClose={onClose}
        preferenceStatus={preferenceStatus}
      />

      <article className="quote-print-page" aria-label={`Hóa đơn ${document.code}`}>
        <header className="quote-print-heading">
          <div>
            {settings.logo_data_url ? (
              <img alt="" className="quote-print-logo" src={settings.logo_data_url} />
            ) : null}
            <strong>{settings.shop_name}</strong>
            {settings.shop_address ? <p>{settings.shop_address}</p> : null}
            {settings.shop_phone ? <p>ĐT: {settings.shop_phone}</p> : null}
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

        <section className="quote-print-parties" aria-label="Thông tin hóa đơn">
          <dl>
            <div>
              <dt>Khách hàng</dt>
              <dd>{document.customer.name}</dd>
            </div>
            <div>
              <dt>Điện thoại</dt>
              <dd>{document.customer.phone ?? ''}</dd>
            </div>
            <div>
              <dt>Nhân viên</dt>
              <dd>{document.seller.name}</dd>
            </div>
            <div>
              <dt>Bảng giá</dt>
              <dd>{displayPriceListName(document.price_list)}</dd>
            </div>
          </dl>
        </section>

        <table aria-label="Dòng hàng hóa đơn" className="quote-print-lines">
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
              const dimension = salesDocumentLineDimensionText(item)
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

        <section className="quote-print-totals" aria-label="Tổng hóa đơn">
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
              <dt>Khách cần trả</dt>
              <dd>{salesDocumentMoneyText(document.total_amount)}</dd>
            </div>
            <div>
              <dt>Khách đã trả</dt>
              <dd>{salesDocumentMoneyText(document.paid_amount)}</dd>
            </div>
            {remainingDebt > 0 ? (
              <div>
                <dt>Còn nợ</dt>
                <dd>{salesDocumentMoneyText(remainingDebt)}</dd>
              </div>
            ) : null}
            {surplus > 0 ? (
              <div>
                <dt>Tiền thừa</dt>
                <dd>{salesDocumentMoneyText(surplus)}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {document.note ? (
          <section className="quote-print-note" aria-label="Ghi chú">
            <h2>Ghi chú</h2>
            <p>{document.note}</p>
          </section>
        ) : null}

        <p className="quote-print-footnote">{invoiceFooterText(printContent)}</p>
      </article>
    </main>
  )
}
