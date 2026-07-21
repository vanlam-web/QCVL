export type BillTemplateId = 'a4' | 'k80'

export interface OrganizationBillSettings {
  shop_name: string
  shop_address: string
  shop_phone: string
  default_bill_template: BillTemplateId
}

export const defaultOrganizationBillSettings: OrganizationBillSettings = {
  shop_name: 'QCVL',
  shop_address: 'Xưởng in và thi công quảng cáo',
  shop_phone: '',
  default_bill_template: 'a4',
}

const storageKey = 'qcvl.organizationBillSettings'

export function isBillTemplateId(value: string | null | undefined): value is BillTemplateId {
  return value === 'a4' || value === 'k80'
}

export function normalizeOrganizationBillSettings(
  input: Partial<OrganizationBillSettings> | null | undefined,
): OrganizationBillSettings {
  return {
    shop_name: (input?.shop_name ?? defaultOrganizationBillSettings.shop_name).trim() || defaultOrganizationBillSettings.shop_name,
    shop_address: (input?.shop_address ?? defaultOrganizationBillSettings.shop_address).trim(),
    shop_phone: (input?.shop_phone ?? defaultOrganizationBillSettings.shop_phone).trim(),
    default_bill_template: isBillTemplateId(input?.default_bill_template)
      ? input.default_bill_template
      : defaultOrganizationBillSettings.default_bill_template,
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
    ? 'Khổ hẹp ~80mm cho máy in nhiệt quầy. Ẩn bớt cột mã hàng, ĐVT, CK.'
    : 'Khổ giấy A4 — đủ cột, phù hợp in laser/in PDF gửi khách.'
}
