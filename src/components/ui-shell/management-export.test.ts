import { describe, expect, it, vi } from 'vitest'

import { buildManagementCsv, downloadManagementCsv } from './management-export'

describe('management export', () => {
  it('builds an Excel-friendly CSV with quoted values and UTF-8 BOM', () => {
    const csv = buildManagementCsv([
      ['Mã phiếu', 'Ghi chú'],
      ['TT001', 'Thu "nợ", khách A'],
    ])

    expect(csv).toBe('\uFEFFMã phiếu,Ghi chú\r\nTT001,"Thu ""nợ"", khách A"')
  })

  it('downloads a CSV file through a temporary link', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadManagementCsv({
      filename: 'so-quy.csv',
      rows: [['Mã phiếu'], ['TT001']],
    })

    expect(createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export')

    createObjectURL.mockRestore()
    revokeObjectURL.mockRestore()
    click.mockRestore()
  })
})
