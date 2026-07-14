import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { within } from '@testing-library/react'
import { CustomerImportDialog } from './CustomerImportDialog'

it('previews a KiotViet customer file before importing', async () => {
  const service = {
    previewKiotVietCustomerImport: vi.fn(async () => ({
      summary: {
        total_rows: 531,
        valid_rows: 531,
        invalid_rows: 0,
        create_rows: 500,
        update_rows: 31,
        group_rows: 5,
        kiotviet_debt_total: 255351893,
        kiotviet_total_sales: 4968878453,
        ignored_columns: ['Chi nhánh tạo', 'Email', 'Facebook'],
      },
      invalid_rows: [],
    })),
    importKiotVietCustomers: vi.fn(),
  }

  render(<CustomerImportDialog open service={service as never} onClose={vi.fn()} onImported={vi.fn()} />)
  const file = new File(['fake-xlsx'], 'DanhSachKhachHang_KV11072026-234256-524.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  await userEvent.upload(screen.getByLabelText('File KiotViet'), file)
  await userEvent.click(screen.getByRole('button', { name: 'Xem trước' }))

  expect(service.previewKiotVietCustomerImport).toHaveBeenCalledWith({ file })
  expect(await screen.findByText('531 dòng hợp lệ')).toBeInTheDocument()
  expect(screen.getByText('500 tạo mới')).toBeInTheDocument()
  expect(screen.getByText('31 cập nhật')).toBeInTheDocument()
  expect(screen.getByText('5 nhóm khách')).toBeInTheDocument()
  expect(screen.getByText('255 351 893')).toBeInTheDocument()
  expect(screen.getByText('4 968 878 453')).toBeInTheDocument()
  expect(screen.getByText('Bỏ qua: Chi nhánh tạo, Email, Facebook')).toBeInTheDocument()
})

it('requires customer preview before import', async () => {
  const service = {
    previewKiotVietCustomerImport: vi.fn(async () => ({
      summary: {
        total_rows: 1,
        valid_rows: 1,
        invalid_rows: 0,
        create_rows: 1,
        update_rows: 0,
        group_rows: 0,
        kiotviet_debt_total: 0,
        kiotviet_total_sales: 0,
        ignored_columns: [],
      },
      invalid_rows: [],
    })),
    importKiotVietCustomers: vi.fn(async () => ({
      summary: { created_rows: 1, updated_rows: 0, skipped_rows: 0 },
      invalid_rows: [],
    })),
  }
  const onImported = vi.fn()
  render(<CustomerImportDialog open service={service as never} onClose={vi.fn()} onImported={onImported} />)
  const file = new File(['fake-xlsx'], 'customers.xlsx')

  await userEvent.upload(screen.getByLabelText('File KiotViet'), file)
  expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Xem trước' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Import' }))

  expect(service.importKiotVietCustomers).toHaveBeenCalledWith({ file })
  expect(onImported).toHaveBeenCalled()
})

it('deletes old KiotViet customer import data from a separate action', async () => {
  const service = {
    previewKiotVietCustomerImport: vi.fn(),
    importKiotVietCustomers: vi.fn(),
    deleteImportedKiotVietCustomers: vi.fn(async () => ({ deleted_rows: 531, blocked_rows: 0 })),
  }
  const onImported = vi.fn()
  render(<CustomerImportDialog open service={service as never} onClose={vi.fn()} onImported={onImported} />)

  await userEvent.click(screen.getByRole('button', { name: 'Xóa dữ liệu cũ' }))
  const confirmDialog = screen.getByRole('alertdialog', { name: 'Xác nhận xóa dữ liệu cũ' })
  await userEvent.click(within(confirmDialog).getByRole('button', { name: 'Xóa' }))

  expect(service.deleteImportedKiotVietCustomers).toHaveBeenCalled()
  expect(await screen.findByText('Đã xóa 531 dòng dữ liệu cũ.')).toBeInTheDocument()
  expect(onImported).toHaveBeenCalled()
})
