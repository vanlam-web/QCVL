export type BillTemplateId = 'a4' | 'k80'
export type BillDocumentType = 'invoice' | 'quote'

export interface BillPrintTemplate {
  id: string
  name: string
  document_type: BillDocumentType
  paper_size: BillTemplateId
  title: string
  footer_note: string
  show_product_code: boolean
  show_unit: boolean
  show_discount: boolean
  is_default: boolean
}

export interface OrganizationBillSettings {
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
  templates: BillPrintTemplate[]
}

export const maxBillTemplatesPerDocumentType = 5

export const defaultOrganizationBillSettings: OrganizationBillSettings = {
  shop_name: 'QCVL',
  shop_address: 'Xưởng in và thi công quảng cáo',
  shop_phone: '',
  default_bill_template: 'a4',
  invoice_title: 'HÓA ĐƠN BÁN HÀNG',
  quote_title: 'BÁO GIÁ',
  footer_note: '',
  show_product_code: true,
  show_unit: true,
  show_discount: true,
  logo_data_url: null,
  templates: [],
}

const storageKey = 'qcvl.organizationBillSettings'
const maxLogoDataUrlLength = 400_000

export function isBillTemplateId(value: string | null | undefined): value is BillTemplateId {
  return value === 'a4' || value === 'k80'
}

export function isBillDocumentType(value: string | null | undefined): value is BillDocumentType {
  return value === 'invoice' || value === 'quote'
}

export function isBillLogoDataUrl(value: string | null | undefined): value is string {
  if (!value) return false
  return /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value) && value.length <= maxLogoDataUrlLength
}

export function createBillTemplateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tpl-${crypto.randomUUID()}`
  }
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function seedBillTemplatesFromFlat(input: Partial<OrganizationBillSettings> | null | undefined): BillPrintTemplate[] {
  const paper = isBillTemplateId(input?.default_bill_template) ? input.default_bill_template : 'a4'
  const invoiceTitle = (input?.invoice_title ?? 'HÓA ĐƠN BÁN HÀNG').trim() || 'HÓA ĐƠN BÁN HÀNG'
  const quoteTitle = (input?.quote_title ?? 'BÁO GIÁ').trim() || 'BÁO GIÁ'
  const footer = (input?.footer_note ?? '').trim()
  const show_product_code = input?.show_product_code ?? true
  const show_unit = input?.show_unit ?? true
  const show_discount = input?.show_discount ?? true
  const columns = { show_product_code, show_unit, show_discount, footer_note: footer }

  return [
    {
      id: 'tpl-invoice-a4',
      name: 'Hóa đơn A4',
      document_type: 'invoice',
      paper_size: 'a4',
      title: invoiceTitle,
      ...columns,
      is_default: paper === 'a4',
    },
    {
      id: 'tpl-invoice-k80',
      name: 'Hóa đơn K80',
      document_type: 'invoice',
      paper_size: 'k80',
      title: invoiceTitle,
      ...columns,
      is_default: paper === 'k80',
    },
    {
      id: 'tpl-quote-a4',
      name: 'Báo giá A4',
      document_type: 'quote',
      paper_size: 'a4',
      title: quoteTitle,
      ...columns,
      is_default: paper === 'a4',
    },
    {
      id: 'tpl-quote-k80',
      name: 'Báo giá K80',
      document_type: 'quote',
      paper_size: 'k80',
      title: quoteTitle,
      ...columns,
      is_default: paper === 'k80',
    },
  ]
}

function normalizeOneTemplate(
  raw: Partial<BillPrintTemplate> | null | undefined,
  fallback: BillPrintTemplate,
): BillPrintTemplate {
  return {
    id: (raw?.id ?? fallback.id).trim() || fallback.id,
    name: (raw?.name ?? fallback.name).trim() || fallback.name,
    document_type: isBillDocumentType(raw?.document_type) ? raw.document_type : fallback.document_type,
    paper_size: isBillTemplateId(raw?.paper_size) ? raw.paper_size : fallback.paper_size,
    title: (raw?.title ?? fallback.title).trim() || fallback.title,
    footer_note: (raw?.footer_note ?? fallback.footer_note).trim(),
    show_product_code: raw?.show_product_code ?? fallback.show_product_code,
    show_unit: raw?.show_unit ?? fallback.show_unit,
    show_discount: raw?.show_discount ?? fallback.show_discount,
    is_default: Boolean(raw?.is_default),
  }
}

export function normalizeBillTemplates(
  input: Partial<OrganizationBillSettings> | null | undefined,
): BillPrintTemplate[] {
  const seeded = seedBillTemplatesFromFlat(input)
  const rawList = Array.isArray(input?.templates) ? input.templates : []
  if (rawList.length === 0) return seeded

  const normalized = rawList
    .map((item, index) => normalizeOneTemplate(item, seeded[Math.min(index, seeded.length - 1)]!))
    .filter((item) => item.id && item.name)

  const byType: BillDocumentType[] = ['invoice', 'quote']
  const result: BillPrintTemplate[] = []
  for (const documentType of byType) {
    const items = normalized.filter((item) => item.document_type === documentType).slice(0, maxBillTemplatesPerDocumentType)
    if (items.length === 0) {
      result.push(...seeded.filter((item) => item.document_type === documentType))
      continue
    }
    if (!items.some((item) => item.is_default)) {
      items[0] = { ...items[0]!, is_default: true }
    } else {
      let seenDefault = false
      for (let index = 0; index < items.length; index += 1) {
        if (!items[index]!.is_default) continue
        if (seenDefault) items[index] = { ...items[index]!, is_default: false }
        else seenDefault = true
      }
    }
    result.push(...items)
  }
  return result
}

export function syncFlatFieldsFromTemplates(templates: BillPrintTemplate[]): Pick<
  OrganizationBillSettings,
  | 'default_bill_template'
  | 'invoice_title'
  | 'quote_title'
  | 'footer_note'
  | 'show_product_code'
  | 'show_unit'
  | 'show_discount'
> {
  const invoiceDefault = templates.find((item) => item.document_type === 'invoice' && item.is_default)
    ?? templates.find((item) => item.document_type === 'invoice')
  const quoteDefault = templates.find((item) => item.document_type === 'quote' && item.is_default)
    ?? templates.find((item) => item.document_type === 'quote')
  return {
    default_bill_template: invoiceDefault?.paper_size ?? 'a4',
    invoice_title: invoiceDefault?.title ?? 'HÓA ĐƠN BÁN HÀNG',
    quote_title: quoteDefault?.title ?? 'BÁO GIÁ',
    footer_note: invoiceDefault?.footer_note ?? '',
    show_product_code: invoiceDefault?.show_product_code ?? true,
    show_unit: invoiceDefault?.show_unit ?? true,
    show_discount: invoiceDefault?.show_discount ?? true,
  }
}

export function applyLegacyFlatPatchToTemplates(
  templates: BillPrintTemplate[],
  input: Partial<OrganizationBillSettings> | null | undefined,
): BillPrintTemplate[] {
  if (!input) return templates
  const paper = isBillTemplateId(input.default_bill_template) ? input.default_bill_template : null
  return templates.map((item) => {
    if (item.document_type === 'invoice' && item.is_default) {
      return {
        ...item,
        title: input.invoice_title !== undefined
          ? (input.invoice_title.trim() || item.title)
          : item.title,
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
        title: input.quote_title !== undefined
          ? (input.quote_title.trim() || item.title)
          : item.title,
        footer_note: input.footer_note !== undefined ? input.footer_note.trim() : item.footer_note,
        show_product_code: input.show_product_code ?? item.show_product_code,
        show_unit: input.show_unit ?? item.show_unit,
        show_discount: input.show_discount ?? item.show_discount,
        paper_size: paper ?? item.paper_size,
      }
    }
    if (paper && item.document_type === 'invoice') {
      return { ...item, is_default: item.paper_size === paper }
    }
    if (paper && item.document_type === 'quote') {
      return { ...item, is_default: item.paper_size === paper }
    }
    return item
  })
}

export function normalizeOrganizationBillSettings(
  input: Partial<OrganizationBillSettings> | null | undefined,
): OrganizationBillSettings {
  const logo = input?.logo_data_url
  const templates = normalizeBillTemplates(input)
  const synced = syncFlatFieldsFromTemplates(templates)
  return {
    shop_name: (input?.shop_name ?? defaultOrganizationBillSettings.shop_name).trim() || defaultOrganizationBillSettings.shop_name,
    shop_address: (input?.shop_address ?? defaultOrganizationBillSettings.shop_address).trim(),
    shop_phone: (input?.shop_phone ?? defaultOrganizationBillSettings.shop_phone).trim(),
    default_bill_template: synced.default_bill_template,
    invoice_title: synced.invoice_title,
    quote_title: synced.quote_title,
    footer_note: synced.footer_note,
    show_product_code: synced.show_product_code,
    show_unit: synced.show_unit,
    show_discount: synced.show_discount,
    logo_data_url: logo === null || logo === ''
      ? null
      : isBillLogoDataUrl(logo)
        ? logo
        : defaultOrganizationBillSettings.logo_data_url,
    templates,
  }
}

/** Local cache of last successful server settings (offline / fast first paint). */
export function readOrganizationBillSettingsCache(): OrganizationBillSettings {
  if (typeof window === 'undefined') return normalizeOrganizationBillSettings(defaultOrganizationBillSettings)
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return normalizeOrganizationBillSettings(defaultOrganizationBillSettings)
    return normalizeOrganizationBillSettings(JSON.parse(raw) as Partial<OrganizationBillSettings>)
  } catch {
    return normalizeOrganizationBillSettings(defaultOrganizationBillSettings)
  }
}

export function writeOrganizationBillSettingsCache(input: Partial<OrganizationBillSettings>): OrganizationBillSettings {
  const current = readOrganizationBillSettingsCache()
  const templates = input.templates
    ? normalizeBillTemplates({ ...current, ...input, templates: input.templates })
    : applyLegacyFlatPatchToTemplates(current.templates, input)
  const next = normalizeOrganizationBillSettings({
    ...current,
    ...input,
    templates,
  })
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  }
  return next
}

/** @deprecated Prefer server API; kept as cache alias. */
export function readOrganizationBillSettings() {
  return readOrganizationBillSettingsCache()
}

/** @deprecated Prefer server API; kept as cache alias. */
export function writeOrganizationBillSettings(input: Partial<OrganizationBillSettings>) {
  return writeOrganizationBillSettingsCache(input)
}

export function billTemplateLabel(template: BillTemplateId) {
  return template === 'k80' ? 'K80 (nhiệt)' : 'A4'
}

export function billTemplateDescription(template: BillTemplateId) {
  return template === 'k80'
    ? 'Khổ ~80mm cho máy in nhiệt quầy.'
    : 'Khổ A4 — in laser / PDF gửi khách.'
}

export function billDocumentTypeLabel(documentType: BillDocumentType) {
  return documentType === 'quote' ? 'Báo giá' : 'Hóa đơn'
}

export function isWalkInCustomerCode(code: string | null | undefined) {
  return (code ?? '').trim().toLowerCase() === 'khachle'
}

export function resolveBillTemplate(input: {
  queryTemplate?: string | null
  customerCode?: string | null
  preferredTemplate?: string | null
  orgDefault: BillTemplateId
}): BillTemplateId {
  if (isBillTemplateId(input.queryTemplate)) return input.queryTemplate
  if (!isWalkInCustomerCode(input.customerCode) && isBillTemplateId(input.preferredTemplate)) {
    return input.preferredTemplate
  }
  return input.orgDefault
}

export function resolvePrintTemplateContent(
  settings: OrganizationBillSettings,
  documentType: BillDocumentType,
  paper: BillTemplateId,
): BillPrintTemplate {
  const templates = normalizeBillTemplates(settings)
  return (
    templates.find((item) => item.document_type === documentType && item.paper_size === paper)
    ?? templates.find((item) => item.document_type === documentType && item.is_default)
    ?? templates.find((item) => item.document_type === documentType)
    ?? seedBillTemplatesFromFlat(settings).find((item) => item.document_type === documentType)!
  )
}

export function invoiceFooterText(settings: OrganizationBillSettings | BillPrintTemplate) {
  return settings.footer_note.trim() || 'Bill nội bộ — không phải hóa đơn điện tử.'
}

export function quoteFooterText(settings: OrganizationBillSettings | BillPrintTemplate) {
  return settings.footer_note.trim() || 'Giá trị báo giá chỉ dùng để xác nhận nội dung trước khi bán.'
}

export function createBlankBillTemplate(documentType: BillDocumentType, paper: BillTemplateId = 'a4'): BillPrintTemplate {
  return {
    id: createBillTemplateId(),
    name: documentType === 'quote' ? `Báo giá ${billTemplateLabel(paper)}` : `Hóa đơn ${billTemplateLabel(paper)}`,
    document_type: documentType,
    paper_size: paper,
    title: documentType === 'quote' ? 'BÁO GIÁ' : 'HÓA ĐƠN BÁN HÀNG',
    footer_note: '',
    show_product_code: true,
    show_unit: true,
    show_discount: true,
    is_default: false,
  }
}

export async function readImageFileAsDataUrl(file: File): Promise<string> {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  if (!allowed.includes(file.type)) {
    throw new Error('Chỉ nhận ảnh PNG, JPG hoặc WEBP.')
  }
  if (file.size > 280_000) {
    throw new Error('Logo tối đa khoảng 280KB.')
  }
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      if (!isBillLogoDataUrl(result)) {
        reject(new Error('Ảnh logo không hợp lệ hoặc quá lớn.'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(new Error('Không đọc được file ảnh.'))
    reader.readAsDataURL(file)
  })
}
