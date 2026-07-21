import {
  billTemplateDescription,
  billTemplateLabel,
  defaultOrganizationBillSettings,
  isBillTemplateId,
  normalizeOrganizationBillSettings,
  readOrganizationBillSettings,
  writeOrganizationBillSettings,
} from './bill-settings'

describe('organization bill settings', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns defaults when storage is empty', () => {
    expect(readOrganizationBillSettings()).toEqual(defaultOrganizationBillSettings)
  })

  it('persists shop fields and default template', () => {
    const saved = writeOrganizationBillSettings({
      shop_name: 'In ảnh Văn Lâm',
      shop_address: '12 Nguyễn Trãi',
      shop_phone: '0909111222',
      default_bill_template: 'k80',
    })
    expect(saved.default_bill_template).toBe('k80')
    expect(readOrganizationBillSettings()).toEqual(saved)
  })

  it('normalizes blank shop name back to default', () => {
    expect(normalizeOrganizationBillSettings({ shop_name: '   ' }).shop_name).toBe('QCVL')
  })

  it('validates template ids', () => {
    expect(isBillTemplateId('a4')).toBe(true)
    expect(isBillTemplateId('k80')).toBe(true)
    expect(isBillTemplateId('thermal')).toBe(false)
    expect(billTemplateLabel('k80')).toBe('K80 (nhiệt)')
  })

  it('describes templates for the settings UI', () => {
    expect(billTemplateDescription('a4')).toMatch(/A4/)
    expect(billTemplateDescription('k80')).toMatch(/80mm/)
  })
})
