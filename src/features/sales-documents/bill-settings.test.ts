import {
  billTemplateDescription,
  billTemplateLabel,
  defaultOrganizationBillSettings,
  invoiceFooterText,
  isBillTemplateId,
  isWalkInCustomerCode,
  normalizeOrganizationBillSettings,
  quoteFooterText,
  readOrganizationBillSettings,
  resolveBillTemplate,
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
      invoice_title: 'PHIẾU BÁN',
      show_product_code: false,
    })
    expect(saved.default_bill_template).toBe('k80')
    expect(saved.invoice_title).toBe('PHIẾU BÁN')
    expect(saved.show_product_code).toBe(false)
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

  it('uses custom footer when set', () => {
    expect(invoiceFooterText({ ...defaultOrganizationBillSettings, footer_note: 'Cảm ơn quý khách' })).toBe('Cảm ơn quý khách')
    expect(quoteFooterText(defaultOrganizationBillSettings)).toMatch(/báo giá/i)
  })

  it('detects walk-in customer code', () => {
    expect(isWalkInCustomerCode('khachle')).toBe(true)
    expect(isWalkInCustomerCode('KHACHLE')).toBe(true)
    expect(isWalkInCustomerCode('KH001')).toBe(false)
  })

  it('resolves template: query > customer preference > org default', () => {
    expect(
      resolveBillTemplate({
        queryTemplate: 'a4',
        customerCode: 'KH001',
        preferredTemplate: 'k80',
        orgDefault: 'k80',
      }),
    ).toBe('a4')
    expect(
      resolveBillTemplate({
        queryTemplate: null,
        customerCode: 'KH001',
        preferredTemplate: 'k80',
        orgDefault: 'a4',
      }),
    ).toBe('k80')
    expect(
      resolveBillTemplate({
        queryTemplate: null,
        customerCode: 'khachle',
        preferredTemplate: 'k80',
        orgDefault: 'a4',
      }),
    ).toBe('a4')
    expect(
      resolveBillTemplate({
        queryTemplate: null,
        customerCode: 'KH001',
        preferredTemplate: null,
        orgDefault: 'a4',
      }),
    ).toBe('a4')
  })
})
