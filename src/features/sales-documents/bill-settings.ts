export type BillTemplateId = 'a4' | 'k80'
export type BillDocumentType = 'invoice' | 'quote'

export interface BillPrintTemplate {
  id: string
  name: string
  document_type: BillDocumentType
  paper_size: BillTemplateId
  title: string
  /** Thông điệp / khuyến mại trên đầu bill (KV: nội dung tĩnh + token). */
  header_note: string
  footer_note: string
  show_logo: boolean
  show_shop_address: boolean
  show_shop_phone: boolean
  show_customer_phone: boolean
  show_seller: boolean
  show_price_list: boolean
  show_notes: boolean
  /** Hóa đơn: khối khách đã trả / còn nợ / tiền thừa. */
  show_payment_summary: boolean
  show_signatures: boolean
  show_product_code: boolean
  show_unit: boolean
  show_discount: boolean
  is_default: boolean
}

export interface OrganizationBillSettings {
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
  templates: BillPrintTemplate[]
}

export const maxBillTemplatesPerDocumentType = 5

export const defaultOrganizationBillSettings: OrganizationBillSettings = {
  shop_name: 'QCVL',
  shop_address: 'Xưởng in và thi công quảng cáo',
  shop_phone: '',
  print_place: '',
  default_bill_template: 'a4',
  invoice_title: 'HÓA ĐƠN BÁN HÀNG',
  quote_title: 'BẢNG BÁO GIÁ',
  footer_note: '',
  show_product_code: false,
  show_unit: true,
  show_discount: false,
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

/** Defaults theo khổ giấy — A4 bám mẫu KV xưởng (không mã hàng/CK cột, có chữ ký). */
export function defaultBillTemplateLayoutFields(
  input?: Partial<BillPrintTemplate>,
  paper: BillTemplateId = isBillTemplateId(input?.paper_size) ? input.paper_size : 'a4',
) {
  const a4 = paper === 'a4'
  return {
    header_note: (input?.header_note ?? '').trim(),
    footer_note: (input?.footer_note ?? '').trim(),
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

export function seedBillTemplatesFromFlat(input: Partial<OrganizationBillSettings> | null | undefined): BillPrintTemplate[] {
  const paper = isBillTemplateId(input?.default_bill_template) ? input.default_bill_template : 'a4'
  const invoiceTitle = (input?.invoice_title ?? 'HÓA ĐƠN BÁN HÀNG').trim() || 'HÓA ĐƠN BÁN HÀNG'
  const quoteTitle = (input?.quote_title ?? 'BẢNG BÁO GIÁ').trim() || 'BẢNG BÁO GIÁ'
  // Không ép show_product_code / show_discount từ flat lên mọi khổ — A4/K80 có default riêng.
  const invoiceA4Footer = (input?.footer_note ?? '').trim() || 'Giá trên chưa bao gồm thuế.'

  return [
    {
      id: 'tpl-invoice-a4',
      name: 'Hóa đơn A4',
      document_type: 'invoice',
      paper_size: 'a4',
      title: invoiceTitle,
      ...defaultBillTemplateLayoutFields({
        show_unit: input?.show_unit,
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
        show_unit: input?.show_unit,
        footer_note: input?.footer_note,
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
        show_unit: input?.show_unit,
        footer_note: input?.footer_note,
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
        show_unit: input?.show_unit,
        footer_note: input?.footer_note,
        paper_size: 'k80',
      }, 'k80'),
      is_default: paper === 'k80',
    },
  ]
}

function normalizeOneTemplate(
  raw: Partial<BillPrintTemplate> | null | undefined,
  fallback: BillPrintTemplate,
): BillPrintTemplate {
  const paper = isBillTemplateId(raw?.paper_size) ? raw.paper_size : fallback.paper_size
  const layout = defaultBillTemplateLayoutFields({
    ...fallback,
    ...raw,
    paper_size: paper,
    header_note: raw?.header_note ?? fallback.header_note,
    footer_note: raw?.footer_note ?? fallback.footer_note,
  }, paper)
  return {
    id: (raw?.id ?? fallback.id).trim() || fallback.id,
    name: (raw?.name ?? fallback.name).trim() || fallback.name,
    document_type: isBillDocumentType(raw?.document_type) ? raw.document_type : fallback.document_type,
    paper_size: paper,
    title: (raw?.title ?? fallback.title).trim() || fallback.title,
    ...layout,
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
    quote_title: quoteDefault?.title ?? 'BẢNG BÁO GIÁ',
    footer_note: invoiceDefault?.footer_note ?? '',
    show_product_code: invoiceDefault?.show_product_code ?? false,
    show_unit: invoiceDefault?.show_unit ?? true,
    show_discount: invoiceDefault?.show_discount ?? false,
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
    print_place: (input?.print_place ?? defaultOrganizationBillSettings.print_place).trim(),
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

export function isBillPreferenceValue(value: string | null | undefined): value is string {
  const trimmed = (value ?? '').trim()
  if (!trimmed || trimmed.length > 80) return false
  if (isBillTemplateId(trimmed)) return true
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(trimmed)
}

export function normalizeBillPreferenceValue(value: string | null | undefined): string | null {
  if (!isBillPreferenceValue(value)) return null
  return value.trim()
}

/** Danh sách mẫu bill theo khách (SoT §4). Legacy 1 giá trị → mảng 1 phần tử. */
export function normalizeBillPreferenceList(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? value.split(/[,|]/).map((part) => part.trim())
      : []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of raw) {
    const normalized = normalizeBillPreferenceValue(typeof item === 'string' ? item : null)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
    if (result.length >= maxBillTemplatesPerDocumentType) break
  }
  return result
}

export function resolveCustomerBillPreferenceIds(input: {
  preferredTemplates?: string[] | null
  preferredTemplate?: string | null
}): string[] {
  const list = normalizeBillPreferenceList(input.preferredTemplates)
  if (list.length > 0) return list
  const one = normalizeBillPreferenceValue(input.preferredTemplate)
  return one ? [one] : []
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

/** Resolve named template: query (?template=id|a4) → customer preference (primary / list) → org default. */
export function resolvePreferredNamedTemplate(input: {
  settings: OrganizationBillSettings
  documentType: BillDocumentType
  queryTemplate?: string | null
  customerCode?: string | null
  preferredTemplate?: string | null
  preferredTemplates?: string[] | null
}): BillPrintTemplate {
  const query = input.queryTemplate?.trim() || null
  if (query && isBillPreferenceValue(query)) {
    return resolveNamedPrintTemplate(input.settings, input.documentType, {
      templateId: query,
      paper: isBillTemplateId(query) ? query : null,
    })
  }
  if (!isWalkInCustomerCode(input.customerCode)) {
    const ids = resolveCustomerBillPreferenceIds({
      preferredTemplates: input.preferredTemplates,
      preferredTemplate: input.preferredTemplate,
    })
    const primary = normalizeBillPreferenceValue(input.preferredTemplate)
    const preferred = primary && ids.includes(primary) ? primary : ids[0] ?? null
    if (preferred) {
      return resolveNamedPrintTemplate(input.settings, input.documentType, {
        templateId: preferred,
        paper: isBillTemplateId(preferred) ? preferred : null,
      })
    }
  }
  return resolveNamedPrintTemplate(input.settings, input.documentType, {
    paper: input.settings.default_bill_template,
  })
}

export function billTemplateSlotCode(index: number) {
  if (index < 0) return '?'
  if (index < 26) return String.fromCharCode(65 + index)
  return String(index + 1)
}

export function listBillTemplatesForDocument(
  settings: OrganizationBillSettings,
  documentType: BillDocumentType,
): BillPrintTemplate[] {
  return normalizeBillTemplates(settings).filter((item) => item.document_type === documentType)
}

export function resolveNamedPrintTemplate(
  settings: OrganizationBillSettings,
  documentType: BillDocumentType,
  input: { templateId?: string | null; paper?: string | null } = {},
): BillPrintTemplate {
  const list = listBillTemplatesForDocument(settings, documentType)
  if (input.templateId) {
    const byId = list.find((item) => item.id === input.templateId)
    if (byId) return byId
  }
  if (isBillTemplateId(input.paper)) {
    return resolvePrintTemplateContent(settings, documentType, input.paper)
  }
  return list.find((item) => item.is_default) ?? list[0] ?? seedBillTemplatesFromFlat(settings).find((item) => item.document_type === documentType)!
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
  return settings.footer_note.trim() || 'Giá trên chưa bao gồm thuế.'
}

export function quoteFooterText(settings: OrganizationBillSettings | BillPrintTemplate) {
  return settings.footer_note.trim() || 'Giá trị báo giá chỉ dùng để xác nhận nội dung trước khi bán.'
}

/** Dòng địa danh + ngày cuối bill kiểu KV: `TP. Hồ Chí Minh, ngày 21 tháng 07 năm 2026`. */
export function formatBillPlaceDate(createdAt: string, printPlace?: string | null) {
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return ''
  const day = String(created.getDate()).padStart(2, '0')
  const month = String(created.getMonth() + 1).padStart(2, '0')
  const year = created.getFullYear()
  const datePart = `ngày ${day} tháng ${month} năm ${year}`
  const place = (printPlace ?? '').trim()
  return place ? `${place}, ${datePart}` : datePart.charAt(0).toUpperCase() + datePart.slice(1)
}

export function createBlankBillTemplate(documentType: BillDocumentType, paper: BillTemplateId = 'a4'): BillPrintTemplate {
  const footer = documentType === 'invoice' && paper === 'a4' ? 'Giá trên chưa bao gồm thuế.' : ''
  return {
    id: createBillTemplateId(),
    name: documentType === 'quote' ? `Báo giá ${billTemplateLabel(paper)}` : `Hóa đơn ${billTemplateLabel(paper)}`,
    document_type: documentType,
    paper_size: paper,
    title: documentType === 'quote' ? 'BẢNG BÁO GIÁ' : 'HÓA ĐƠN BÁN HÀNG',
    ...defaultBillTemplateLayoutFields({ footer_note: footer, paper_size: paper }, paper),
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
