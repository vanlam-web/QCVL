import { describe, expect, it } from 'vitest'
import { vietnameseMoneyInWords } from './money-words-vi'
import { buildVietQrImageUrl, resolveVietnamBankBin } from './vietqr'

describe('vietnameseMoneyInWords', () => {
  it('formats common bill totals', () => {
    expect(vietnameseMoneyInWords(0)).toBe('Không đồng.')
    expect(vietnameseMoneyInWords(391500)).toMatch(/ba trăm.*đồng chẵn\./i)
    expect(vietnameseMoneyInWords(4_974_962)).toMatch(/bốn triệu.*đồng chẵn\./i)
  })
})

describe('vietqr helpers', () => {
  it('resolves MB Bank bin and builds image url', () => {
    expect(resolveVietnamBankBin('MB Bank')).toBe('970422')
    expect(buildVietQrImageUrl({
      bankName: 'MB Bank',
      accountNumber: '0947900909',
      accountHolder: 'Van Viet Phuong Lam',
    })).toContain('970422-0947900909-compact2.png')
  })
})
