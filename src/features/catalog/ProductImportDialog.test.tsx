import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductImportDialog } from './ProductImportDialog'

it('previews a KiotViet product file before importing', async () => {
  const service = {
    previewKiotVietProductImport: vi.fn(async () => ({
      summary: {
        total_rows: 657,
        valid_rows: 657,
        invalid_rows: 0,
        create_rows: 640,
        update_rows: 17,
        unit_review_rows: 11,
        price_rows: 620,
        price_skipped_rows: 37,
        provisional_stock_rows: 517,
        provisional_stock_skipped_rows: 140,
        bom_rows: 189,
        bom_skipped_rows: 468,
        price_list_name: 'Bảng giá lẻ',
        cleanup_demo_requested: false,
        ignored_columns: ['Thương hiệu', 'Vị trí'],
        deferred_columns: ['Dự kiến hết hàng'],
      },
      invalid_rows: [],
    })),
    importKiotVietProducts: vi.fn(),
    deleteImportedKiotVietProducts: vi.fn(),
  }

  render(<ProductImportDialog open service={service as never} onClose={vi.fn()} onImported={vi.fn()} />)
  const file = new File(['fake-xlsx'], 'DanhSachSanPham_KV09072026-215404-812.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  await userEvent.upload(screen.getByLabelText('File KiotViet'), file)
  await userEvent.click(screen.getByRole('button', { name: 'Xem trước' }))

  expect(service.previewKiotVietProductImport).toHaveBeenCalledWith({ file, cleanup_demo: false })
  expect(await screen.findByText('657 dòng hợp lệ')).toBeInTheDocument()
  expect(screen.getByText('640 tạo mới')).toBeInTheDocument()
  expect(screen.getByText('17 cập nhật')).toBeInTheDocument()
  expect(screen.getByText('620 dòng giá bán')).toBeInTheDocument()
  expect(screen.getByText('517 dòng tồn tạm')).toBeInTheDocument()
  expect(screen.getByText('189 dòng BOM')).toBeInTheDocument()
  expect(screen.getByText('Giá chung')).toBeInTheDocument()
  expect(screen.getByText('11 cần sửa')).toBeInTheDocument()
  expect(screen.queryByText(/thiếu ĐVT/)).not.toBeInTheDocument()
  expect(screen.getByText('Bỏ qua: Thương hiệu, Vị trí')).toBeInTheDocument()
})

it('requires preview before import', async () => {
  const service = {
    previewKiotVietProductImport: vi.fn(async () => ({
      summary: {
        total_rows: 1,
        valid_rows: 1,
        invalid_rows: 0,
        create_rows: 1,
        update_rows: 0,
        unit_review_rows: 0,
        cleanup_demo_requested: true,
        ignored_columns: [],
        deferred_columns: [],
      },
      invalid_rows: [],
    })),
    importKiotVietProducts: vi.fn(async () => ({
      summary: { created_rows: 1, updated_rows: 0, cleanup_deleted_rows: 3, cleanup_blocked_rows: 0 },
      invalid_rows: [],
    })),
    deleteImportedKiotVietProducts: vi.fn(),
  }
  const onImported = vi.fn()
  render(<ProductImportDialog open service={service as never} onClose={vi.fn()} onImported={onImported} />)
  const file = new File(['fake-xlsx'], 'products.xlsx')

  await userEvent.upload(screen.getByLabelText('File KiotViet'), file)
  expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Xem trước' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Import' }))

  expect(service.importKiotVietProducts).toHaveBeenCalledWith({ file, cleanup_demo: false })
  expect(onImported).toHaveBeenCalled()
})

it('deletes old KiotViet product import data from a separate action', async () => {
  const service = {
    previewKiotVietProductImport: vi.fn(),
    importKiotVietProducts: vi.fn(),
    deleteImportedKiotVietProducts: vi.fn(async () => ({ deleted_rows: 517, blocked_rows: 0 })),
  }
  const onImported = vi.fn()
  render(<ProductImportDialog open service={service as never} onClose={vi.fn()} onImported={onImported} />)

  await userEvent.click(screen.getByRole('button', { name: 'Xóa dữ liệu cũ' }))
  const confirmDialog = screen.getByRole('alertdialog', { name: 'Xác nhận xóa dữ liệu cũ' })
  await userEvent.click(within(confirmDialog).getByRole('button', { name: 'Xóa' }))

  expect(service.deleteImportedKiotVietProducts).toHaveBeenCalled()
  expect(await screen.findByText('Đã xóa 517 dòng dữ liệu cũ.')).toBeInTheDocument()
  expect(onImported).toHaveBeenCalled()
})
