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
  /** Địa danh trước dòng ngày cuối bill (vd. TP. Hồ Chí Minh). */
  print_place: string
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

export function isBillPreferenceValue(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 80) return false
  if (isBillTemplateId(trimmed)) return true
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(trimmed)
}

export function normalizeBillPreferenceValue(value: unknown): string | null {
  if (value === null || value === '') return null
  if (!isBillPreferenceValue(value)) return null
  return value.trim()
}

/** Danh sách mẫu bill theo khách (SoT §4). Tối đa 5 id; legacy string đơn → mảng 1 phần tử. */
export function normalizeBillPreferenceList(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? value.split(/[,|]/).map((part) => part.trim())
      : []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of raw) {
    const normalized = normalizeBillPreferenceValue(item)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
    if (result.length >= maxBillTemplatesPerDocumentType) break
  }
  return result
}

export function resolveCustomerBillPreferenceIds(input: {
  preferred_bill_templates?: unknown
  preferred_bill_template?: unknown
}): string[] {
  const list = normalizeBillPreferenceList(input.preferred_bill_templates)
  if (list.length > 0) return list
  const one = normalizeBillPreferenceValue(input.preferred_bill_template ?? null)
  return one ? [one] : []
}

/** Đồng bộ primary + list khi PATCH khách. */
export function syncCustomerBillPreferencePatch(input: {
  preferred_bill_template?: string | null
  preferred_bill_templates?: string[] | null
  currentTemplate?: string | null
  currentTemplates?: string[] | null
}): { preferred_bill_template: string | null; preferred_bill_templates: string[] } {
  const hasList = input.preferred_bill_templates !== undefined
  const hasPrimary = input.preferred_bill_template !== undefined
  let list = hasList
    ? normalizeBillPreferenceList(input.preferred_bill_templates)
    : resolveCustomerBillPreferenceIds({
        preferred_bill_templates: input.currentTemplates,
        preferred_bill_template: input.currentTemplate,
      })
  let primary = hasPrimary
    ? normalizeBillPreferenceValue(input.preferred_bill_template)
    : normalizeBillPreferenceValue(input.currentTemplate ?? null)

  if (hasList && !hasPrimary) {
    primary = list[0] ?? null
  }
  if (hasPrimary && !hasList) {
    if (primary) {
      list = list.includes(primary) ? list : [primary, ...list].slice(0, maxBillTemplatesPerDocumentType)
    } else {
      list = []
    }
  }
  if (primary && !list.includes(primary)) {
    list = [primary, ...list].slice(0, maxBillTemplatesPerDocumentType)
  }
  if (!primary && list.length > 0) {
    primary = list[0]!
  }
  if (list.length === 0) {
    primary = null
  }
  return { preferred_bill_template: primary, preferred_bill_templates: list }
}

function isBillDocumentType(value: unknown): value is BillDocumentType {
  return value === 'invoice' || value === 'quote'
}

function defaultBillTemplateLayoutFields(
  input?: Partial<BillPrintTemplateData>,
  paper: BillTemplateId = isBillTemplateId(input?.paper_size) ? input.paper_size : 'a4',
) {
  const a4 = paper === 'a4'
  return {
    header_note: String(input?.header_note ?? '').trim(),
    footer_note: String(input?.footer_note ?? '').trim(),
    show_logo: input?.show_logo ?? true,
    show_shop_address: input?.show_shop_address ?? true,
    show_shop_phone: input?.show_shop_phone ?? true,
    show_customer_phone: input?.show_customer_phone ?? true,
    show_seller: input?.show_seller ?? !a4,
    show_price_list: input?.show_price_list ?? !a4,
    show_notes: input?.show_notes ?? true,
    show_payment_summary: input?.show_payment_summary ?? true,
    show_signatures: input?.show_signatures ?? a4,
    show_product_code: input?.show_product_code ?? !a4,
    show_unit: input?.show_unit ?? true,
    show_discount: input?.show_discount ?? !a4,
  }
}

export function seedBillTemplatesFromFlat(input: Partial<OrganizationBillSettingsData>): BillPrintTemplateData[] {
  const paper = isBillTemplateId(input.default_bill_template) ? input.default_bill_template : 'a4'
  const invoiceTitle = (input.invoice_title ?? 'HÓA ĐƠN BÁN HÀNG').trim() || 'HÓA ĐƠN BÁN HÀNG'
  const quoteTitle = (input.quote_title ?? 'BẢNG BÁO GIÁ').trim() || 'BẢNG BÁO GIÁ'
  const invoiceA4Footer = String(input.footer_note ?? '').trim() || 'Giá trên chưa bao gồm thuế.'
  return [
    {
      id: 'tpl-invoice-a4',
      name: 'Hóa đơn A4',
      document_type: 'invoice',
      paper_size: 'a4',
      title: invoiceTitle,
      ...defaultBillTemplateLayoutFields({
        show_unit: input.show_unit,
        footer_note: invoiceA4Footer,
        paper_size: 'a4',
      }, 'a4'),
      is_default: paper === 'a4',
    },
    {
      id: 'tpl-invoice-k80',
      name: 'Hóa đơn K80',
      document_type: 'invoice',
      paper_size: 'k80',
      title: invoiceTitle,
      ...defaultBillTemplateLayoutFields({
        show_unit: input.show_unit,
        footer_note: input.footer_note,
        paper_size: 'k80',
      }, 'k80'),
      is_default: paper === 'k80',
    },
    {
      id: 'tpl-quote-a4',
      name: 'Báo giá A4',
      document_type: 'quote',
      paper_size: 'a4',
      title: quoteTitle,
      ...defaultBillTemplateLayoutFields({
        show_unit: input.show_unit,
        footer_note: input.footer_note,
        paper_size: 'a4',
      }, 'a4'),
      is_default: paper === 'a4',
    },
    {
      id: 'tpl-quote-k80',
      name: 'Báo giá K80',
      document_type: 'quote',
      paper_size: 'k80',
      title: quoteTitle,
      ...defaultBillTemplateLayoutFields({
        show_unit: input.show_unit,
        footer_note: input.footer_note,
        paper_size: 'k80',
      }, 'k80'),
      is_default: paper === 'k80',
    },
  ]
}

function normalizeOneTemplate(raw: unknown, fallback: BillPrintTemplateData): BillPrintTemplateData | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<BillPrintTemplateData>
  const id = String(item.id ?? fallback.id).trim()
  const name = String(item.name ?? fallback.name).trim()
  if (!id || !name) return null
  const paper = isBillTemplateId(item.paper_size) ? item.paper_size : fallback.paper_size
  const layout = defaultBillTemplateLayoutFields({
    ...fallback,
    ...item,
    paper_size: paper,
    header_note: item.header_note ?? fallback.header_note,
    footer_note: item.footer_note ?? fallback.footer_note,
  }, paper)
  return {
    id,
    name,
    document_type: isBillDocumentType(item.document_type) ? item.document_type : fallback.document_type,
    paper_size: paper,
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
    quote_title: quoteDefault?.title ?? 'BẢNG BÁO GIÁ',
    footer_note: invoiceDefault?.footer_note ?? '',
    show_product_code: invoiceDefault?.show_product_code ?? false,
    show_unit: invoiceDefault?.show_unit ?? true,
    show_discount: invoiceDefault?.show_discount ?? false,
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
    print_place: (input.print_place ?? '').trim(),
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
