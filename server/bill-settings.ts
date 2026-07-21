export type BillTemplateId = 'a4' | 'k80'
export type BillDocumentType = 'invoice' | 'quote'

export interface BillPrintTemplateData {
  id: string
  name: string
  document_type: BillDocumentType
  paper_size: BillTemplateId
  title: string
  header_note: string
  footer_note: string
  show_logo: boolean
  show_shop_address: boolean
  show_shop_phone: boolean
  show_customer_phone: boolean
  show_seller: boolean
  show_price_list: boolean
  show_notes: boolean
  show_payment_summary: boolean
  show_signatures: boolean
  show_product_code: boolean
  show_unit: boolean
  show_discount: boolean
  is_default: boolean
}

export interface OrganizationBillSettingsData {
  shop_name: string
  shop_address: string
  shop_phone: string
  default_bill_template: BillTemplateId
  invoice_title: string
  quote_title: string
  footer_note: string
  show_product_code: boolean
  show_unit: boolean
  show_discount: boolean
  logo_data_url: string | null
  templates: BillPrintTemplateData[]
}

export const maxBillTemplatesPerDocumentType = 5

function isBillTemplateId(value: unknown): value is BillTemplateId {
  return value === 'a4' || value === 'k80'
}

function isBillDocumentType(value: unknown): value is BillDocumentType {
  return value === 'invoice' || value === 'quote'
}

function defaultBillTemplateLayoutFields(input?: Partial<BillPrintTemplateData>) {
  return {
    header_note: String(input?.header_note ?? '').trim(),
    footer_note: String(input?.footer_note ?? '').trim(),
    show_logo: input?.show_logo ?? true,
    show_shop_address: input?.show_shop_address ?? true,
    show_shop_phone: input?.show_shop_phone ?? true,
    show_customer_phone: input?.show_customer_phone ?? true,
    show_seller: input?.show_seller ?? true,
    show_price_list: input?.show_price_list ?? true,
    show_notes: input?.show_notes ?? true,
    show_payment_summary: input?.show_payment_summary ?? true,
    show_signatures: input?.show_signatures ?? false,
    show_product_code: input?.show_product_code ?? true,
    show_unit: input?.show_unit ?? true,
    show_discount: input?.show_discount ?? true,
  }
}

export function seedBillTemplatesFromFlat(input: Partial<OrganizationBillSettingsData>): BillPrintTemplateData[] {
  const paper = isBillTemplateId(input.default_bill_template) ? input.default_bill_template : 'a4'
  const invoiceTitle = (input.invoice_title ?? 'HÓA ĐƠN BÁN HÀNG').trim() || 'HÓA ĐƠN BÁN HÀNG'
  const quoteTitle = (input.quote_title ?? 'BÁO GIÁ').trim() || 'BÁO GIÁ'
  const layout = defaultBillTemplateLayoutFields({
    footer_note: input.footer_note,
    show_product_code: input.show_product_code,
    show_unit: input.show_unit,
    show_discount: input.show_discount,
  })
  return [
    { id: 'tpl-invoice-a4', name: 'Hóa đơn A4', document_type: 'invoice', paper_size: 'a4', title: invoiceTitle, ...layout, is_default: paper === 'a4' },
    { id: 'tpl-invoice-k80', name: 'Hóa đơn K80', document_type: 'invoice', paper_size: 'k80', title: invoiceTitle, ...layout, is_default: paper === 'k80' },
    { id: 'tpl-quote-a4', name: 'Báo giá A4', document_type: 'quote', paper_size: 'a4', title: quoteTitle, ...layout, is_default: paper === 'a4' },
    { id: 'tpl-quote-k80', name: 'Báo giá K80', document_type: 'quote', paper_size: 'k80', title: quoteTitle, ...layout, is_default: paper === 'k80' },
  ]
}

function normalizeOneTemplate(raw: unknown, fallback: BillPrintTemplateData): BillPrintTemplateData | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<BillPrintTemplateData>
  const id = String(item.id ?? fallback.id).trim()
  const name = String(item.name ?? fallback.name).trim()
  if (!id || !name) return null
  const layout = defaultBillTemplateLayoutFields({
    ...fallback,
    ...item,
    header_note: item.header_note ?? fallback.header_note,
    footer_note: item.footer_note ?? fallback.footer_note,
  })
  return {
    id,
    name,
    document_type: isBillDocumentType(item.document_type) ? item.document_type : fallback.document_type,
    paper_size: isBillTemplateId(item.paper_size) ? item.paper_size : fallback.paper_size,
    title: String(item.title ?? fallback.title).trim() || fallback.title,
    ...layout,
    is_default: Boolean(item.is_default),
  }
}

export function normalizeBillTemplates(input: Partial<OrganizationBillSettingsData>): BillPrintTemplateData[] {
  const seeded = seedBillTemplatesFromFlat(input)
  const rawList = Array.isArray(input.templates) ? input.templates : []
  if (rawList.length === 0) return seeded

  const normalized = rawList
    .map((item, index) => normalizeOneTemplate(item, seeded[Math.min(index, seeded.length - 1)]!))
    .filter((item): item is BillPrintTemplateData => Boolean(item))

  const result: BillPrintTemplateData[] = []
  for (const documentType of ['invoice', 'quote'] as BillDocumentType[]) {
    const items = normalized.filter((item) => item.document_type === documentType).slice(0, maxBillTemplatesPerDocumentType)
    if (items.length === 0) {
      result.push(...seeded.filter((item) => item.document_type === documentType))
      continue
    }
    if (!items.some((item) => item.is_default)) items[0] = { ...items[0]!, is_default: true }
    else {
      let seen = false
      for (let index = 0; index < items.length; index += 1) {
        if (!items[index]!.is_default) continue
        if (seen) items[index] = { ...items[index]!, is_default: false }
        else seen = true
      }
    }
    result.push(...items)
  }
  return result
}

export function syncFlatFieldsFromTemplates(templates: BillPrintTemplateData[]) {
  const invoiceDefault = templates.find((item) => item.document_type === 'invoice' && item.is_default)
    ?? templates.find((item) => item.document_type === 'invoice')
  const quoteDefault = templates.find((item) => item.document_type === 'quote' && item.is_default)
    ?? templates.find((item) => item.document_type === 'quote')
  return {
    default_bill_template: (invoiceDefault?.paper_size ?? 'a4') as BillTemplateId,
    invoice_title: invoiceDefault?.title ?? 'HÓA ĐƠN BÁN HÀNG',
    quote_title: quoteDefault?.title ?? 'BÁO GIÁ',
    footer_note: invoiceDefault?.footer_note ?? '',
    show_product_code: invoiceDefault?.show_product_code ?? true,
    show_unit: invoiceDefault?.show_unit ?? true,
    show_discount: invoiceDefault?.show_discount ?? true,
  }
}

export function applyLegacyFlatPatchToTemplates(
  templates: BillPrintTemplateData[],
  input: Partial<OrganizationBillSettingsData>,
): BillPrintTemplateData[] {
  const paper = isBillTemplateId(input.default_bill_template) ? input.default_bill_template : null
  return templates.map((item) => {
    if (item.document_type === 'invoice' && item.is_default) {
      return {
        ...item,
        title: input.invoice_title !== undefined ? (input.invoice_title.trim() || item.title) : item.title,
        footer_note: input.footer_note !== undefined ? input.footer_note.trim() : item.footer_note,
        show_product_code: input.show_product_code ?? item.show_product_code,
        show_unit: input.show_unit ?? item.show_unit,
        show_discount: input.show_discount ?? item.show_discount,
        paper_size: paper ?? item.paper_size,
      }
    }
    if (item.document_type === 'quote' && item.is_default) {
      return {
        ...item,
        title: input.quote_title !== undefined ? (input.quote_title.trim() || item.title) : item.title,
        footer_note: input.footer_note !== undefined ? input.footer_note.trim() : item.footer_note,
        show_product_code: input.show_product_code ?? item.show_product_code,
        show_unit: input.show_unit ?? item.show_unit,
        show_discount: input.show_discount ?? item.show_discount,
        paper_size: paper ?? item.paper_size,
      }
    }
    if (paper && (item.document_type === 'invoice' || item.document_type === 'quote')) {
      return { ...item, is_default: item.paper_size === paper }
    }
    return item
  })
}

export function normalizeOrganizationBillSettingsData(
  input: Partial<OrganizationBillSettingsData> & { organization_name?: string },
): OrganizationBillSettingsData {
  const fallbackName = (input.organization_name ?? input.shop_name ?? 'QCVL').trim() || 'QCVL'
  const templates = normalizeBillTemplates(input)
  const synced = syncFlatFieldsFromTemplates(templates)
  const logo = input.logo_data_url
  return {
    shop_name: (input.shop_name ?? fallbackName).trim() || fallbackName,
    shop_address: (input.shop_address ?? '').trim(),
    shop_phone: (input.shop_phone ?? '').trim(),
    ...synced,
    logo_data_url: logo === null || logo === ''
      ? null
      : typeof logo === 'string' && /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(logo) && logo.length <= 400_000
        ? logo
        : null,
    templates,
  }
}

export function mergeOrganizationBillSettingsPatch(
  current: OrganizationBillSettingsData,
  patch: Partial<OrganizationBillSettingsData>,
): OrganizationBillSettingsData {
  const templates = patch.templates
    ? normalizeBillTemplates({ ...current, ...patch, templates: patch.templates })
    : applyLegacyFlatPatchToTemplates(current.templates, patch)
  return normalizeOrganizationBillSettingsData({
    ...current,
    ...patch,
    templates,
  })
}
