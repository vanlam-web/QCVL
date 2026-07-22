import {
  billTemplateDescription,
  billTemplateLabel,
  billTemplateSlotCode,
  defaultOrganizationBillSettings,
  formatBillPlaceDate,
  invoiceFooterText,
  isBillPreferenceValue,
  isBillTemplateId,
  isWalkInCustomerCode,
  listBillTemplatesForDocument,
  normalizeOrganizationBillSettings,
  quoteFooterText,
  readOrganizationBillSettings,
  resolveBillTemplate,
  resolveNamedPrintTemplate,
  resolvePreferredNamedTemplate,
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
    const quote = normalizeOrganizationBillSettings(defaultOrganizationBillSettings).templates.find(
      (item) => item.document_type === 'quote' && item.paper_size === 'a4',
    )!
    expect(quoteFooterText(quote)).toMatch(/báo giá/i)
  })

  it('seeds A4 templates to match shop KiotViet bill defaults', () => {
    const settings = normalizeOrganizationBillSettings(defaultOrganizationBillSettings)
    expect(settings.quote_title).toBe('BẢNG BÁO GIÁ')
    expect(settings.print_place).toBe('')
    const invoiceA4 = settings.templates.find((item) => item.id === 'tpl-invoice-a4')
    expect(invoiceA4?.show_product_code).toBe(false)
    expect(invoiceA4?.show_discount).toBe(false)
    expect(invoiceA4?.show_signatures).toBe(true)
    expect(invoiceA4?.show_price_list).toBe(false)
    expect(invoiceA4?.footer_note).toMatch(/chưa bao gồm thuế/i)
    const invoiceK80 = settings.templates.find((item) => item.id === 'tpl-invoice-k80')
    expect(invoiceK80?.show_product_code).toBe(true)
    expect(invoiceK80?.show_signatures).toBe(false)
  })

  it('formats place + date like KV bill footer', () => {
    expect(formatBillPlaceDate('2026-07-21T10:00:00Z', 'TP. Hồ Chí Minh')).toMatch(
      /TP\. Hồ Chí Minh, ngày \d{2} tháng \d{2} năm 2026/,
    )
    expect(formatBillPlaceDate('2026-07-01T03:30:00Z', '')).toMatch(/^Ngày \d{2} tháng \d{2} năm 2026$/)
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

  it('resolves preferred named template by query id then customer preference', () => {
    const settings = normalizeOrganizationBillSettings({ default_bill_template: 'a4' })
    expect(isBillPreferenceValue('tpl-invoice-k80')).toBe(true)
    expect(
      resolvePreferredNamedTemplate({
        settings,
        documentType: 'invoice',
        queryTemplate: 'tpl-invoice-k80',
        preferredTemplate: 'a4',
        customerCode: 'KH001',
      }).id,
    ).toBe('tpl-invoice-k80')
    expect(
      resolvePreferredNamedTemplate({
        settings,
        documentType: 'invoice',
        preferredTemplate: 'tpl-invoice-k80',
        customerCode: 'KH001',
      }).id,
    ).toBe('tpl-invoice-k80')
    expect(
      resolvePreferredNamedTemplate({
        settings,
        documentType: 'invoice',
        preferredTemplate: 'k80',
        customerCode: 'KH001',
      }).paper_size,
    ).toBe('k80')
  })

  it('fills deeper layout toggles when older templates omit them', () => {
    const settings = normalizeOrganizationBillSettings({
      templates: [
        {
          id: 'tpl-invoice-a4',
          name: 'Hóa đơn A4',
          document_type: 'invoice',
          paper_size: 'a4',
          title: 'HÓA ĐƠN',
          footer_note: '',
          show_product_code: true,
          show_unit: true,
          show_discount: false,
          is_default: true,
        } as never,
      ],
    })
    const invoice = settings.templates.find((item) => item.document_type === 'invoice')!
    expect(invoice.show_logo).toBe(true)
    // A4 mặc định bật chữ ký khi mẫu cũ không lưu field này.
    expect(invoice.show_signatures).toBe(true)
    expect(invoice.show_payment_summary).toBe(true)
    expect(invoice.header_note).toBe('')
    expect(invoice.show_discount).toBe(false)
  })
})
