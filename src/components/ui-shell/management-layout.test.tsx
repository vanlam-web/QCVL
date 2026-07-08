import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useState, type FormEvent } from 'react'
import {
  ManagementActionIconButton,
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementDetailActionFooter,
  ManagementDetailRow,
  ManagementFilterGroup,
  ManagementFilterSidebar,
  ManagementListSurface,
  ManagementPagination,
  ManagementPage,
  ManagementRowActionButton,
  ManagementTableFooter,
  ManagementTableViewport,
} from './management-layout'

it('keeps retired management toolbar patterns out of the shared source', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/index.css'), 'utf8')
  const layout = readFileSync(join(process.cwd(), 'src/components/ui-shell/management-layout.tsx'), 'utf8')
  const retiredPatterns = [
    'DataToolbar',
    'FilterPresetBar',
    'ActiveFilterChips',
    'ManagementSearchBar',
    'management-search-bar',
    'data-toolbar',
    'filter-drawer',
    'catalog-shell',
    'sales-documents-panel',
    'suppliers-panel',
    'purchase-receipts-shell',
  ]

  expect(existsSync(join(process.cwd(), 'src/components/ui-shell/filters.tsx'))).toBe(false)
  for (const pattern of retiredPatterns) {
    expect(css).not.toContain(pattern)
    expect(layout).not.toContain(pattern)
  }
})

it('renders a KV-style management page with filter sidebar and list surface', () => {
  render(
    <ManagementPage
      actions={<button type="button">Tìm nhanh</button>}
      filter={<ManagementFilterSidebar ariaLabel="Bộ lọc hàng hóa">Bộ lọc</ManagementFilterSidebar>}
      kpis={<section aria-label="Tổng quan hàng hóa">Tổng 12 hàng</section>}
      title="Hàng hóa"
    >
      <ManagementListSurface ariaLabel="Danh sách hàng hóa">Danh sách</ManagementListSurface>
    </ManagementPage>,
  )

  expect(screen.getByRole('heading', { name: 'Hàng hóa' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tìm nhanh' }).closest('.management-page-header')).not.toBeNull()
  expect(screen.getByRole('complementary', { name: 'Bộ lọc hàng hóa' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Tổng quan hàng hóa' }).closest('.management-filter-column')).not.toBeNull()
  expect(screen.getByRole('region', { name: 'Tổng quan hàng hóa' }).closest('.management-page-header')).toBeNull()
  expect(screen.getByRole('region', { name: 'Danh sách hàng hóa' })).toBeInTheDocument()
  expect(screen.getByLabelText('Hàng hóa')).toHaveClass('management-layout')
})

it('keeps page title and search toolbar grouped in the management page header', () => {
  render(
    <ManagementPage
      actions={
        <ManagementCompactToolbar ariaLabel="Lọc chứng từ bán hàng" onSubmit={vi.fn()}>
          <ManagementCompactSearch
            label="Tìm chứng từ"
            placeholder="Mã chứng từ, khách hàng"
            value=""
            onChange={vi.fn()}
          />
        </ManagementCompactToolbar>
      }
      title="Chứng từ bán hàng"
    >
      <ManagementListSurface ariaLabel="Danh sách chứng từ">Danh sách</ManagementListSurface>
    </ManagementPage>,
  )

  const header = screen.getByRole('heading', { name: 'Chứng từ bán hàng' }).closest('.management-page-header')
  const search = screen.getByRole('search', { name: 'Lọc chứng từ bán hàng' })

  expect(header).not.toBeNull()
  expect(header).toContainElement(search)
  expect(search.closest('.management-page-actions')).not.toBeNull()
})

it('can hide the filter sidebar and let the list use the full width', () => {
  render(
    <ManagementPage
      filter={<ManagementFilterSidebar ariaLabel="Bộ lọc chứng từ">Bộ lọc</ManagementFilterSidebar>}
      filterVisible={false}
      title="Chứng từ"
    >
      <ManagementListSurface ariaLabel="Danh sách chứng từ">Danh sách</ManagementListSurface>
    </ManagementPage>,
  )

  expect(screen.queryByRole('complementary', { name: 'Bộ lọc chứng từ' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Chứng từ')).toHaveClass('management-layout-filters-hidden')
})

it('renders reusable compact search toolbar with an icon action inside the search box', async () => {
  const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault())
  const onSearchChange = vi.fn()
  const onFilter = vi.fn()

  function CompactToolbarHarness() {
    const [value, setValue] = useState('')

    return (
      <ManagementCompactToolbar ariaLabel="Thanh công cụ chứng từ" onSubmit={onSubmit}>
        <ManagementCompactSearch
          label="Tìm chứng từ"
          placeholder="Theo mã chứng từ"
          trailingAction={
            <button aria-label="Mở bộ lọc nâng cao" type="button" onClick={onFilter}>
              F
            </button>
          }
          value={value}
          onChange={(nextValue) => {
            setValue(nextValue)
            onSearchChange(nextValue)
          }}
        />
        <ManagementActionIconButton ariaLabel="Đặt lại bộ lọc" onClick={vi.fn()}>
          R
        </ManagementActionIconButton>
      </ManagementCompactToolbar>
    )
  }

  render(<CompactToolbarHarness />)

  const toolbar = screen.getByRole('search', { name: 'Thanh công cụ chứng từ' })
  const searchInput = screen.getByLabelText('Tìm chứng từ')
  await userEvent.type(searchInput, 'HD000010')
  await userEvent.click(screen.getByRole('button', { name: 'Mở bộ lọc nâng cao' }))
  await userEvent.click(searchInput)
  await userEvent.keyboard('{Enter}')

  expect(toolbar).toHaveClass('management-compact-toolbar')
  expect(screen.getByLabelText('Tìm chứng từ').closest('.management-compact-search')).toContainElement(
    screen.getByRole('button', { name: 'Mở bộ lọc nâng cao' }),
  )
  expect(onSearchChange).toHaveBeenLastCalledWith('HD000010')
  expect(onFilter).toHaveBeenCalledTimes(1)
  expect(onSubmit).toHaveBeenCalled()
})

it('renders the shared compact create action as the standard plus button', () => {
  render(<ManagementCompactCreateAction ariaLabel="Tạo khách hàng" onClick={vi.fn()} />)

  const action = screen.getByRole('button', { name: 'Tạo khách hàng' })
  expect(action).toHaveClass('management-compact-create-action')
  expect(action).not.toHaveClass('button-primary')
  expect(action.querySelector('.lucide-plus')).not.toBeNull()
})

it('renders reusable scroll body and footer pagination outside the table scroll area', () => {
  render(
    <ManagementListSurface ariaLabel="Danh sách chứng từ">
      <ManagementTableViewport>
        <table>
          <tbody>
            <tr>
              <td>HD000010</td>
            </tr>
          </tbody>
        </table>
      </ManagementTableViewport>
      <ManagementPagination ariaLabel="Phân trang chứng từ">
        <span>12 chứng từ</span>
      </ManagementPagination>
    </ManagementListSurface>,
  )

  expect(document.querySelector('.management-table-viewport')).toContainElement(screen.getByText('HD000010'))
  expect(screen.getByRole('navigation', { name: 'Phân trang chứng từ' })).toHaveClass('management-pagination')
  expect(screen.getByRole('navigation', { name: 'Phân trang chứng từ' }).closest('.management-table-viewport')).toBeNull()
})

it('standardizes filter groups without rendering detail content by default', () => {
  render(
    <ManagementFilterSidebar ariaLabel="Bộ lọc phiếu nhập">
      <ManagementFilterGroup title="Trạng thái">
        <label>
          <input type="radio" />
          Phiếu tạm
        </label>
      </ManagementFilterGroup>
    </ManagementFilterSidebar>,
  )

  expect(screen.getByRole('heading', { name: 'Trạng thái' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: /Chi tiết/ })).not.toBeInTheDocument()
})

it('renders filter sidebar content without a duplicated header summary', () => {
  render(
    <ManagementFilterSidebar
      activeSummary="Loại: Hóa đơn"
      ariaLabel="Bộ lọc chứng từ"
      title="Bộ lọc"
      actions={<button type="button">Đặt lại bộ lọc</button>}
    >
      <ManagementFilterGroup title="Loại chứng từ">
        <label>
          <input type="radio" />
          Hóa đơn
        </label>
      </ManagementFilterGroup>
    </ManagementFilterSidebar>,
  )

  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc chứng từ' })
  expect(within(sidebar).queryByRole('heading', { name: 'Bộ lọc' })).not.toBeInTheDocument()
  expect(within(sidebar).queryByText('Loại: Hóa đơn')).not.toBeInTheDocument()
  expect(within(sidebar).getByRole('button', { name: 'Đặt lại bộ lọc' }).closest('.management-filter-actions')).not.toBeNull()
})

it('renders a reusable management table footer with range page and disabled controls', () => {
  const onFirst = vi.fn()
  const onLast = vi.fn()
  const onPageSizeChange = vi.fn()

  render(
    <ManagementTableFooter
      ariaLabel="Phân trang chứng từ"
      canGoNext
      canGoPrevious={false}
      entityLabel="chứng từ"
      page={1}
      pageSize={15}
      total={40}
      onFirst={onFirst}
      onLast={onLast}
      onNext={vi.fn()}
      onPageSizeChange={onPageSizeChange}
      onPrevious={vi.fn()}
    />,
  )

  const footer = screen.getByRole('navigation', { name: 'Phân trang chứng từ' })
  expect(footer).toHaveClass('management-table-footer')
  expect(within(footer).getByText('Hiển thị')).toBeInTheDocument()
  expect(within(footer).getByRole('combobox', { name: 'Số dòng hiển thị' })).toHaveValue('15')
  expect(within(footer).getByRole('textbox', { name: 'Trang hiện tại' })).toHaveValue('1')
  expect(within(footer).getByText('1 - 15 trong 40 chứng từ')).toBeInTheDocument()
  expect(within(footer).getByRole('button', { name: 'Trang đầu' })).toBeDisabled()
  expect(within(footer).getByRole('button', { name: 'Trang trước' })).toBeDisabled()
  expect(within(footer).getByRole('button', { name: 'Trang sau' })).toBeEnabled()
  expect(within(footer).getByRole('button', { name: 'Trang cuối' })).toBeEnabled()
})

it('renders compact row action buttons and inline detail rows tied to the table', async () => {
  const onTableClick = vi.fn()

  render(
    <table onClick={onTableClick}>
      <tbody>
        <tr className="management-data-row-selected">
          <td>HD010985</td>
          <td>
            <ManagementRowActionButton ariaLabel="Mở chi tiết HD010985">Mở</ManagementRowActionButton>
          </td>
        </tr>
        <ManagementDetailRow colSpan={2} label="Chi tiết chứng từ HD010985">
          <p>Chi tiết</p>
        </ManagementDetailRow>
      </tbody>
    </table>,
  )

  expect(screen.getByRole('button', { name: 'Mở chi tiết HD010985' })).toHaveClass('management-row-action')
  const detailRegion = screen.getByRole('region', { name: 'Chi tiết chứng từ HD010985' })
  expect(detailRegion).toHaveClass('management-inline-detail')
  expect(detailRegion.closest('tr')).toHaveClass('management-detail-row-selected')
  expect(screen.getByRole('cell', { name: /Chi tiết/ })).toHaveAttribute('colspan', '2')

  await userEvent.click(within(detailRegion).getByText('Chi tiết'))

  expect(onTableClick).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('cell', { name: /Chi tiết/ }))

  expect(onTableClick).not.toHaveBeenCalled()
})

it('renders shared detail action footer with left and right action groups', () => {
  const onPrint = vi.fn()

  render(
    <ManagementDetailActionFooter
      leftActions={[
        { label: 'Hủy', danger: true, disabled: true, icon: <span data-testid="cancel-icon" /> },
        { label: 'Sao chép', disabled: true },
      ]}
      rightActions={[
        { label: 'Sửa', disabled: true },
        { label: 'Lưu', variant: 'primary', disabled: true },
        { label: 'In', onClick: onPrint },
      ]}
    />,
  )

  const footer = screen.getByText('Hủy').closest('.management-detail-footer-actions')
  expect(footer).not.toBeNull()
  expect(within(footer as HTMLElement).getByRole('button', { name: 'Hủy' })).toHaveClass('button-danger')
  expect(within(footer as HTMLElement).getByRole('button', { name: 'Hủy' })).toBeDisabled()
  expect(within(footer as HTMLElement).getByRole('button', { name: 'Lưu' })).toHaveClass('button-primary')
  expect(footer?.querySelector('.management-detail-footer-actions-left')).toContainElement(screen.getByTestId('cancel-icon'))
  expect(footer?.querySelector('.management-detail-footer-actions-right')).toContainElement(screen.getByRole('button', { name: 'In' }))
})
