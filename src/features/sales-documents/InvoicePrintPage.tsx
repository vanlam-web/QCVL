import { useEffect, useState } from 'react'
import { formatApiError } from '../../lib/api/error-message'
import { BillPrintToolbar } from './BillPrintToolbar'
import { BillPrintSheet, type BillPrintBankAccount } from './BillPrintSheet'
import {
  isWalkInCustomerCode,
  listBillTemplatesForDocument,
  readOrganizationBillSettingsCache,
  resolveNamedPrintTemplate,
  resolvePreferredNamedTemplate,
  writeOrganizationBillSettingsCache,
  type OrganizationBillSettings,
} from './bill-settings'
import type { SalesDocumentService } from './sales-document-service'
import type { SalesDocumentDetail } from './types'

export function InvoicePrintPage({
  documentId,
  service,
  onClose,
  initialTemplate,
  loadBillSettings,
  loadBillBankAccount,
  saveCustomerBillPreference,
}: {
  documentId: string
  service: SalesDocumentService
  onClose: () => void
  initialTemplate?: string | null
  loadBillSettings?: () => Promise<OrganizationBillSettings>
  loadBillBankAccount?: () => Promise<BillPrintBankAccount | null>
  saveCustomerBillPreference?: (customerId: string, template: string) => Promise<void>
}) {
  const [document, setDocument] = useState<SalesDocumentDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<OrganizationBillSettings>(() => readOrganizationBillSettingsCache())
  const [bankAccount, setBankAccount] = useState<BillPrintBankAccount | null>(null)
  const [templateId, setTemplateId] = useState<string>(() =>
    resolvePreferredNamedTemplate({
      settings: readOrganizationBillSettingsCache(),
      documentType: 'invoice',
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
        const [result, remoteSettings, bank] = await Promise.all([
          service.getSalesDocument(documentId),
          loadBillSettings ? loadBillSettings().catch(() => null) : Promise.resolve(null),
          loadBillBankAccount ? loadBillBankAccount().catch(() => null) : Promise.resolve(null),
        ])
        if (!active) return
        setDocument(result)
        setBankAccount(bank)
        let nextSettings = readOrganizationBillSettingsCache()
        if (remoteSettings) {
          nextSettings = writeOrganizationBillSettingsCache(remoteSettings)
          setSettings(nextSettings)
        }
        setTemplateId(
          resolvePreferredNamedTemplate({
            settings: nextSettings,
            documentType: 'invoice',
            queryTemplate: initialTemplate,
            customerCode: result.customer.code,
            preferredTemplate: result.customer.preferred_bill_template,
          }).id,
        )
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được hóa đơn.'))
      }
    }

    void loadDocument()

    return () => {
      active = false
    }
  }, [documentId, initialTemplate, loadBillBankAccount, loadBillSettings, service])

  async function handleTemplateSelect(nextId: string) {
    setTemplateId(nextId)
    setPreferenceStatus(null)
    const named = resolveNamedPrintTemplate(settings, 'invoice', { templateId: nextId })
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

  return (
    <main className={`quote-print-shell bill-template-${printContent.paper_size}`}>
      <BillPrintToolbar
        templates={invoiceTemplates}
        selectedTemplateId={printContent.id}
        onTemplateSelect={handleTemplateSelect}
        onPrint={() => window.print()}
        onClose={onClose}
        preferenceStatus={preferenceStatus}
      />
      <BillPrintSheet
        document={document}
        settings={settings}
        printContent={printContent}
        bankAccount={bankAccount}
      />
    </main>
  )
}
