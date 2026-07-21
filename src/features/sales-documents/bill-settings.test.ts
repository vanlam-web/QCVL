import {
  billTemplateDescription,
  billTemplateLabel,
  billTemplateSlotCode,
  defaultOrganizationBillSettings,
  invoiceFooterText,
  isBillTemplateId,
  isWalkInCustomerCode,
  listBillTemplatesForDocument,
  normalizeOrganizationBillSettings,
  quoteFooterText,
  readOrganizationBillSettings,
  resolveBillTemplate,
  resolveNamedPrintTemplate,
  resolvePrintTemplateContent,
  writeOrganizationBillSettings,
} from './bill-settings'

describe('organization bill settings', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns seeded defaults when storage is empty', () => {
    expect(readOrganizationBillSettings()).toEqual(normalizeOrganizationBillSettings(defaultOrganizationBillSettings))
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
    const withFooter = normalizeOrganizationBillSettings({
      ...defaultOrganizationBillSettings,
      footer_note: 'Cảm ơn quý khách',
    })
    expect(invoiceFooterText(withFooter)).toBe('Cảm ơn quý khách')
    expect(quoteFooterText(normalizeOrganizationBillSettings(defaultOrganizationBillSettings))).toMatch(/báo giá/i)
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
  })

  it('seeds named templates and resolves print content by paper size', () => {
    const settings = normalizeOrganizationBillSettings({
      default_bill_template: 'k80',
      invoice_title: 'PHIẾU BÁN',
    })
    expect(settings.templates.length).toBe(4)
    expect(settings.default_bill_template).toBe('k80')
    expect(settings.invoice_title).toBe('PHIẾU BÁN')
    expect(resolvePrintTemplateContent(settings, 'invoice', 'k80').title).toBe('PHIẾU BÁN')
  })

  it('lists templates and resolves named print selection like KV A/B/C slots', () => {
    const settings = normalizeOrganizationBillSettings({
      default_bill_template: 'a4',
      invoice_title: 'HÓA ĐƠN BÁN HÀNG',
    })
    const invoices = listBillTemplatesForDocument(settings, 'invoice')
    expect(invoices.map((item) => item.paper_size)).toEqual(['a4', 'k80'])
    expect(billTemplateSlotCode(0)).toBe('A')
    expect(billTemplateSlotCode(1)).toBe('B')
    expect(billTemplateSlotCode(2)).toBe('C')

    expect(resolveNamedPrintTemplate(settings, 'invoice', { paper: 'k80' }).id).toBe('tpl-invoice-k80')
    expect(resolveNamedPrintTemplate(settings, 'invoice', { templateId: 'tpl-invoice-a4' }).paper_size).toBe('a4')
    expect(resolveNamedPrintTemplate(settings, 'invoice', {}).is_default).toBe(true)
  })
})
