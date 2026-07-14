import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SupplierImportDialog } from './SupplierImportDialog'

it('previews a KiotViet supplier file before importing', async () => {
  const service = {
    previewKiotVietSupplierImport: vi.fn(async () => ({
      summary: {
        total_rows: 44,
        valid_rows: 44,
        invalid_rows: 0,
        create_rows: 40,
        update_rows: 4,
        kiotviet_payable_total: 500000,
        kiotviet_total_purchase: 33983289,
        ignored_columns: ['Số CMND/CCCD', 'Nhóm nhà cung cấp'],
      },
      invalid_rows: [],
    })),
    importKiotVietSuppliers: vi.fn(),
    deleteImportedKiotVietSuppliers: vi.fn(),
  }

  render(<SupplierImportDialog open service={service as never} onClose={vi.fn()} onImported={vi.fn()} />)
  const file = new File(['fake-xlsx'], 'DanhSachNhaCungCap_KV12072026-131429-622.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  await userEvent.upload(screen.getByLabelText('File KiotViet'), file)
  await userEvent.click(screen.getByRole('button', { name: 'Xem trước' }))

  expect(service.previewKiotVietSupplierImport).toHaveBeenCalledWith({ file })
  expect(await screen.findByText('44 dòng hợp lệ')).toBeInTheDocument()
  expect(screen.getByText('40 tạo mới')).toBeInTheDocument()
  expect(screen.getByText('4 cập nhật')).toBeInTheDocument()
  expect(screen.getByText('500 000')).toBeInTheDocument()
  expect(screen.getByText('33 983 289')).toBeInTheDocument()
  expect(screen.getByText('Bỏ qua: Số CMND/CCCD, Nhóm nhà cung cấp')).toBeInTheDocument()
})

it('requires supplier preview before import', async () => {
  const service = {
    previewKiotVietSupplierImport: vi.fn(async () => ({
      summary: {
        total_rows: 1,
        valid_rows: 1,
        invalid_rows: 0,
        create_rows: 1,
        update_rows: 0,
        kiotviet_payable_total: 0,
        kiotviet_total_purchase: 0,
        ignored_columns: [],
      },
      invalid_rows: [],
    })),
    importKiotVietSuppliers: vi.fn(async () => ({
      summary: { created_rows: 1, updated_rows: 0, skipped_rows: 0 },
      invalid_rows: [],
    })),
    deleteImportedKiotVietSuppliers: vi.fn(),
  }
  const onImported = vi.fn()
  render(<SupplierImportDialog open service={service as never} onClose={vi.fn()} onImported={onImported} />)
  const file = new File(['fake-xlsx'], 'suppliers.xlsx')

  await userEvent.upload(screen.getByLabelText('File KiotViet'), file)
  expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Xem trước' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Import' }))

  expect(service.importKiotVietSuppliers).toHaveBeenCalledWith({ file })
  expect(onImported).toHaveBeenCalled()
})

it('deletes old KiotViet supplier import data from a separate action', async () => {
  const service = {
    previewKiotVietSupplierImport: vi.fn(),
    importKiotVietSuppliers: vi.fn(),
    deleteImportedKiotVietSuppliers: vi.fn(async () => ({ deleted_rows: 44, blocked_rows: 0 })),
  }
  const onImported = vi.fn()
  const onOldDataDeleted = vi.fn()
  render(
    <SupplierImportDialog
      open
      service={service as never}
      onClose={vi.fn()}
      onImported={onImported}
      onOldDataDeleted={onOldDataDeleted}
    />,
  )

  await userEvent.click(screen.getByRole('button', { name: 'Xóa dữ liệu cũ' }))
  const confirmDialog = screen.getByRole('alertdialog', { name: 'Xác nhận xóa dữ liệu cũ' })
  await userEvent.click(within(confirmDialog).getByRole('button', { name: 'Xóa' }))

  expect(service.deleteImportedKiotVietSuppliers).toHaveBeenCalled()
  expect(await screen.findByText('Đã xóa 44 dòng dữ liệu cũ.')).toBeInTheDocument()
  expect(onOldDataDeleted).toHaveBeenCalled()
  expect(onImported).not.toHaveBeenCalled()
})
