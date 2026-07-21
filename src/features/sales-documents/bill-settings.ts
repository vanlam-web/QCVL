export type BillTemplateId = 'a4' | 'k80'

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
}

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
}

const storageKey = 'qcvl.organizationBillSettings'
const maxLogoDataUrlLength = 400_000

export function isBillTemplateId(value: string | null | undefined): value is BillTemplateId {
  return value === 'a4' || value === 'k80'
}

export function isBillLogoDataUrl(value: string | null | undefined): value is string {
  if (!value) return false
  return /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value) && value.length <= maxLogoDataUrlLength
}

export function normalizeOrganizationBillSettings(
  input: Partial<OrganizationBillSettings> | null | undefined,
): OrganizationBillSettings {
  const logo = input?.logo_data_url
  return {
    shop_name: (input?.shop_name ?? defaultOrganizationBillSettings.shop_name).trim() || defaultOrganizationBillSettings.shop_name,
    shop_address: (input?.shop_address ?? defaultOrganizationBillSettings.shop_address).trim(),
    shop_phone: (input?.shop_phone ?? defaultOrganizationBillSettings.shop_phone).trim(),
    default_bill_template: isBillTemplateId(input?.default_bill_template)
      ? input.default_bill_template
      : defaultOrganizationBillSettings.default_bill_template,
    invoice_title:
      (input?.invoice_title ?? defaultOrganizationBillSettings.invoice_title).trim()
      || defaultOrganizationBillSettings.invoice_title,
    quote_title:
      (input?.quote_title ?? defaultOrganizationBillSettings.quote_title).trim()
      || defaultOrganizationBillSettings.quote_title,
    footer_note: (input?.footer_note ?? defaultOrganizationBillSettings.footer_note).trim(),
    show_product_code: input?.show_product_code ?? defaultOrganizationBillSettings.show_product_code,
    show_unit: input?.show_unit ?? defaultOrganizationBillSettings.show_unit,
    show_discount: input?.show_discount ?? defaultOrganizationBillSettings.show_discount,
    logo_data_url: logo === null || logo === ''
      ? null
      : isBillLogoDataUrl(logo)
        ? logo
        : defaultOrganizationBillSettings.logo_data_url,
  }
}

/** Local cache of last successful server settings (offline / fast first paint). */
export function readOrganizationBillSettingsCache(): OrganizationBillSettings {
  if (typeof window === 'undefined') return { ...defaultOrganizationBillSettings }
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return { ...defaultOrganizationBillSettings }
    return normalizeOrganizationBillSettings(JSON.parse(raw) as Partial<OrganizationBillSettings>)
  } catch {
    return { ...defaultOrganizationBillSettings }
  }
}

export function writeOrganizationBillSettingsCache(input: Partial<OrganizationBillSettings>): OrganizationBillSettings {
  const next = normalizeOrganizationBillSettings({
    ...readOrganizationBillSettingsCache(),
    ...input,
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
    ? 'Khổ hẹp ~80mm cho máy in nhiệt quầy. Có thể ẩn cột mã hàng, ĐVT, CK trong Quản lý mẫu in.'
    : 'Khổ giấy A4 — đủ cột, phù hợp in laser/in PDF gửi khách.'
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

export function invoiceFooterText(settings: OrganizationBillSettings) {
  return settings.footer_note.trim() || 'Bill nội bộ — không phải hóa đơn điện tử.'
}

export function quoteFooterText(settings: OrganizationBillSettings) {
  return settings.footer_note.trim() || 'Giá trị báo giá chỉ dùng để xác nhận nội dung trước khi bán.'
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
