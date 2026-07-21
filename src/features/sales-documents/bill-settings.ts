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

export function readOrganizationBillSettings(): OrganizationBillSettings {
  if (typeof window === 'undefined') return { ...defaultOrganizationBillSettings }
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return { ...defaultOrganizationBillSettings }
    return normalizeOrganizationBillSettings(JSON.parse(raw) as Partial<OrganizationBillSettings>)
  } catch {
    return { ...defaultOrganizationBillSettings }
  }
}

export function writeOrganizationBillSettings(input: Partial<OrganizationBillSettings>): OrganizationBillSettings {
  const next = normalizeOrganizationBillSettings({
    ...readOrganizationBillSettings(),
    ...input,
  })
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  }
  return next
}

export function billTemplateLabel(template: BillTemplateId) {
  return template === 'k80' ? 'K80 (nhiệt)' : 'A4'
}
