import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { useState, type FormEvent } from 'react'
import {
  ManagementActionIconButton,
  ManagementCompactCreateAction,
  ManagementCompactSearch,
  ManagementCompactToolbar,
  ManagementDetailActionFooter,
  ManagementDetailHeader,
  ManagementDetailInfoList,
  ManagementDetailInlineNote,
  ManagementDetailPanel,
  ManagementDetailMetaText,
  ManagementDetailNote,
  ManagementDetailNoteInput,
  ManagementDetailSection,
  ManagementDetailSummary,
  ManagementDetailRow,
  ManagementDataTable,
  ManagementFilterGroup,
  ManagementDateRangeInputs,
  ManagementFilterNumberRange,
  ManagementFilterSidebar,
  ManagementFilterSelectField,
  ManagementInlineDetailTabs,
  ManagementListSurface,
  ManagementPagination,
  ManagementPage,
  ManagementRowActionButton,
  ManagementTableCheckboxControl,
  ManagementTableFavoriteButton,
  ManagementTableFooter,
  ManagementTableViewport,
} from './management-layout'
import { ManagementSortableHeader } from './management-sortable-header'
import { useManagementTableSort } from './management-table-sort'

it('keeps retired management toolbar patterns out of the shared source', () => {
  const css = readCssWithImports(join(process.cwd(), 'src/styles/index.css'))
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

function readCssWithImports(path: string, seen = new Set<string>()): string {
  if (seen.has(path)) return ''
  seen.add(path)
  const content = readFileSync(path, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  return content.replace(/@import\s+"([^"]+)";/g, (statement, importPath: string) => {
    if (!importPath.startsWith('.')) return statement
    return readCssWithImports(join(dirname(path), importPath), seen)
  })
}

function SortDemo() {
  const rows = [
    { id: 'old', name: 'Beta', amount: 200, createdAt: '2026-07-07T08:00:00.000Z' },
    { id: 'new', name: 'Alpha', amount: 500, createdAt: '2026-07-08T08:00:00.000Z' },
    { id: 'mid', name: 'Gamma', amount: 100, createdAt: '2026-07-06T08:00:00.000Z' },
  ]
  const { sortedItems, sortState, requestSort } = useManagementTableSort(rows, {
    name: { kind: 'text', value: (row) => row.name },
    amount: { kind: 'number', value: (row) => row.amount },
    createdAt: { kind: 'date', value: (row) => row.createdAt },
  })
  return (
    <table>
      <thead>
        <tr>
          <ManagementSortableHeader kind="text" sortKey="name" sortState={sortState} onSort={requestSort}>Tên</ManagementSortableHeader>
          <ManagementSortableHeader kind="number" sortKey="amount" sortState={sortState} onSort={requestSort}>Tiền</ManagementSortableHeader>
          <ManagementSortableHeader kind="date" sortKey="createdAt" sortState={sortState} onSort={requestSort}>Ngày</ManagementSortableHeader>
        </tr>
      </thead>
      <tbody>
        {sortedItems.map((row) => (
          <tr key={row.id}>
            <td>{row.id}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

it('sorts management table headers by text, number, date, then returns to default order', async () => {
  render(<SortDemo />)
  const user = userEvent.setup()
  const ids = () => screen.getAllByRole('cell').map((cell) => cell.textContent)

  expect(ids()).toEqual(['old', 'new', 'mid'])

  await user.click(screen.getByRole('button', { name: 'Tên' }))
  expect(ids()).toEqual(['new', 'old', 'mid'])

  await user.click(screen.getByRole('button', { name: 'Tên' }))
  expect(ids()).toEqual(['mid', 'old', 'new'])

  await user.click(screen.getByRole('button', { name: 'Tên' }))
  expect(ids()).toEqual(['old', 'new', 'mid'])

  await user.click(screen.getByRole('button', { name: 'Tiền' }))
  expect(ids()).toEqual(['new', 'old', 'mid'])

  await user.click(screen.getByRole('button', { name: 'Ngày' }))
  expect(ids()).toEqual(['new', 'old', 'mid'])
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
  expect(screen.getByLabelText('Chứng từ')).toHaveClass('management-layout-filters-none')
  expect(screen.getByLabelText('Chứng từ')).not.toHaveClass('management-layout-filters-hidden')
})

it('keeps a filter rail when the hidden filter has a collapsed control', () => {
  render(
    <ManagementPage
      filter={<ManagementFilterSidebar ariaLabel="Bộ lọc chứng từ">Bộ lọc</ManagementFilterSidebar>}
      filterCollapsedControl={<button type="button">Mở lọc</button>}
      filterVisible={false}
      title="Chứng từ"
    >
      <ManagementListSurface ariaLabel="Danh sách chứng từ">Danh sách</ManagementListSurface>
    </ManagementPage>,
  )

  expect(screen.getByLabelText('Chứng từ')).toHaveClass('management-layout-filters-hidden')
  expect(screen.getByRole('button', { name: 'Mở lọc' }).closest('.management-filter-rail')).not.toBeNull()
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

it('turns the compact create action into a rotating clear action while searching', async () => {
  function CompactCreateHarness() {
    const [value, setValue] = useState('')

    return (
      <ManagementCompactSearch
        label="Tìm khách hàng"
        placeholder="Tìm mã, tên, số điện thoại"
        trailingAction={<ManagementCompactCreateAction ariaLabel="Tạo khách hàng" onClick={vi.fn()} />}
        value={value}
        onChange={setValue}
      />
    )
  }

  render(<CompactCreateHarness />)

  const searchInput = screen.getByLabelText('Tìm khách hàng')
  expect(screen.getByRole('button', { name: 'Tạo khách hàng' })).toHaveClass('management-compact-create-action')

  await userEvent.type(searchInput, 'kl')
  const clearAction = screen.getByRole('button', { name: 'Xóa tìm kiếm' })
  expect(clearAction).toHaveClass('management-compact-create-action-clear')
  expect(clearAction.querySelector('.lucide-plus')).not.toBeNull()

  await userEvent.click(clearAction)
  expect(searchInput).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Tạo khách hàng' })).toBeInTheDocument()
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

it('renders shared filter select and number range fields', async () => {
  const onStatusChange = vi.fn()
  const onFromChange = vi.fn()
  const onToChange = vi.fn()

  function FilterExample() {
    const [status, setStatus] = useState('active')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')

    function changeStatus(value: string) {
      setStatus(value)
      onStatusChange(value)
    }

    function changeFrom(value: string) {
      setFrom(value)
      onFromChange(value)
    }

    function changeTo(value: string) {
      setTo(value)
      onToChange(value)
    }

    return (
      <ManagementFilterSidebar ariaLabel="Bộ lọc khách hàng">
        <ManagementFilterGroup title="Trạng thái">
          <ManagementFilterSelectField label="Trạng thái" value={status} onChange={changeStatus}>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Ngưng hoạt động</option>
          </ManagementFilterSelectField>
        </ManagementFilterGroup>
        <ManagementFilterGroup title="Tổng bán">
          <ManagementFilterNumberRange
            fromLabel="Tổng bán từ"
            fromValue={from}
            toLabel="Tổng bán tới"
            toValue={to}
            onFromChange={changeFrom}
            onToChange={changeTo}
          />
        </ManagementFilterGroup>
      </ManagementFilterSidebar>
    )
  }

  render(
    <FilterExample />,
  )

  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Trạng thái' }), 'inactive')
  await userEvent.type(screen.getByRole('spinbutton', { name: 'Tổng bán từ' }), '1000')
  await userEvent.type(screen.getByRole('spinbutton', { name: 'Tổng bán tới' }), '2000')

  expect(screen.getByRole('combobox', { name: 'Trạng thái' })).toHaveClass('management-filter-select')
  expect(screen.getByRole('spinbutton', { name: 'Tổng bán từ' })).toHaveClass('management-filter-number-input')
  expect(onStatusChange).toHaveBeenCalledWith('inactive')
  expect(onFromChange).toHaveBeenLastCalledWith('1000')
  expect(onToChange).toHaveBeenLastCalledWith('2000')
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

it('closes filter sidebar popovers when clicking outside', async () => {
  function FilterPopoverHarness() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <ManagementFilterSidebar
          ariaLabel="Bộ lọc kiểm kho"
          onPopoverClose={() => setOpen(false)}
          popoverOpen={open}
        >
          <ManagementFilterGroup title="Ngày tạo">
            {open ? <div role="region" aria-label="Chọn nhanh thời gian">Tháng này</div> : null}
          </ManagementFilterGroup>
        </ManagementFilterSidebar>
        <button type="button">Bên ngoài</button>
      </>
    )
  }

  render(<FilterPopoverHarness />)

  const sidebar = screen.getByRole('complementary', { name: 'Bộ lọc kiểm kho' })
  expect(sidebar).toHaveClass('management-filter-sidebar-popover-open')
  await userEvent.click(within(sidebar).getByRole('region', { name: 'Chọn nhanh thời gian' }))
  expect(screen.getByRole('region', { name: 'Chọn nhanh thời gian' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Bên ngoài' }))

  expect(screen.queryByRole('region', { name: 'Chọn nhanh thời gian' })).not.toBeInTheDocument()
  expect(sidebar).not.toHaveClass('management-filter-sidebar-popover-open')
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

it('renders reusable data table rows with inline detail content', async () => {
  const onSelect = vi.fn()

  render(
    <ManagementDataTable
      ariaLabel="Danh sách khách hàng"
      columns={[
        { key: 'code', header: 'Mã KH', cell: (row) => <strong>{row.code}</strong> },
        { key: 'name', header: 'Tên khách hàng', cell: (row) => row.name },
      ]}
      getDetailLabel={(row) => `Chi tiết ${row.code}`}
      getRowKey={(row) => row.id}
      items={[
        { id: 'customer-1', code: 'KH000001', name: 'Khách lẻ' },
        { id: 'customer-2', code: 'KH000002', name: 'Khách công ty' },
      ]}
      selectedRowKey="customer-2"
      renderDetail={(row) => row.id === 'customer-2' ? <p>Chi tiết {row.code}</p> : null}
      onRowClick={onSelect}
    />,
  )

  const table = screen.getByRole('table', { name: 'Danh sách khách hàng' })
  expect(within(table).getByRole('columnheader', { name: 'Mã KH' })).toBeInTheDocument()
  expect(within(table).getByRole('row', { name: 'KH000001 Khách lẻ' })).toBeInTheDocument()
  expect(within(table).getByRole('row', { name: 'KH000002 Khách công ty' })).toHaveClass('management-data-row-selected')
  expect(screen.getByRole('region', { name: 'Chi tiết KH000002' })).toHaveTextContent('Chi tiết KH000002')

  await userEvent.click(within(table).getByRole('row', { name: 'KH000001 Khách lẻ' }))

  expect(onSelect).toHaveBeenCalledWith({ id: 'customer-1', code: 'KH000001', name: 'Khách lẻ' }, expect.any(Object))
})

it('renders shared checkbox and favorite table controls with legacy-compatible classes', () => {
  const onToggleFavorite = vi.fn()

  render(
    <ManagementDataTable
      ariaLabel="Danh sách hàng hóa"
      columns={[
        {
          key: 'select',
          className: 'finance-cashbook-select-column',
          header: <ManagementTableCheckboxControl ariaLabel="Chọn tất cả dòng hàng hóa" />,
          cell: (row) => <ManagementTableCheckboxControl ariaLabel={`Chọn dòng ${row.code}`} />,
        },
        {
          key: 'favorite',
          className: 'finance-cashbook-star-column',
          header: (
            <ManagementTableFavoriteButton
              active={false}
              ariaLabel="Chỉ hiện hàng ưu tiên"
              onClick={onToggleFavorite}
            />
          ),
          cell: (row) => (
            <ManagementTableFavoriteButton
              active={row.favorite}
              ariaLabel={`Đánh dấu ưu tiên ${row.code}`}
              onClick={onToggleFavorite}
            />
          ),
        },
      ]}
      getRowKey={(row) => row.code}
      items={[{ code: 'MICA-3MM', favorite: true }]}
    />,
  )

  expect(screen.getByRole('checkbox', { name: 'Chọn tất cả dòng hàng hóa' }).parentElement).toHaveClass('finance-cashbook-checkbox-control')
  expect(screen.getByRole('button', { name: 'Chỉ hiện hàng ưu tiên' })).toHaveClass('finance-cashbook-star-button')
  expect(screen.getByRole('button', { name: 'Đánh dấu ưu tiên MICA-3MM' })).toHaveClass('finance-cashbook-star-button-active')
})

it('renders date range inputs as compact date boxes with calendar popovers', async () => {
  const onFromChange = vi.fn()
  const onToChange = vi.fn()

  render(
    <ManagementDateRangeInputs
      from="2026-07-01"
      to="2026-07-31"
      onFromChange={onFromChange}
      onToChange={onToChange}
    />,
  )

  expect(screen.getByText('Từ ngày')).toHaveClass('sr-only')
  expect(screen.getByText('Đến ngày')).toHaveClass('sr-only')
  expect(screen.getByLabelText('Từ ngày')).toHaveValue('01/07/2026')
  expect(screen.getByLabelText('Đến ngày')).toHaveValue('31/07/2026')

  await userEvent.click(screen.getByRole('button', { name: 'Mở lịch Từ ngày' }))

  const calendar = screen.getByRole('dialog', { name: 'Chọn Từ ngày' })
  expect(within(calendar).getByText('Tháng 7 2026')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Mở lịch Đến ngày' }))

  expect(screen.queryByRole('dialog', { name: 'Chọn Từ ngày' })).not.toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: 'Chọn Đến ngày' })).toBeInTheDocument()

  await userEvent.click(document.body)

  expect(screen.queryByRole('dialog', { name: 'Chọn Đến ngày' })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Mở lịch Từ ngày' }))

  const reopenedCalendar = screen.getByRole('dialog', { name: 'Chọn Từ ngày' })
  await userEvent.click(within(reopenedCalendar).getByRole('button', { name: 'Chọn ngày 14/07/2026' }))

  expect(onFromChange).toHaveBeenCalledWith('2026-07-14')
})

it('can display clipped date values while keeping calendar changes bound to real filter values', async () => {
  const onFromChange = vi.fn()
  const onToChange = vi.fn()

  render(
    <ManagementDateRangeInputs
      displayFrom="2026-07-01"
      displayTo="2026-07-14"
      from="2026-07-01"
      to="2026-07-31"
      onFromChange={onFromChange}
      onToChange={onToChange}
    />,
  )

  const inputs = screen.getAllByPlaceholderText('dd/mm/yyyy')
  expect(inputs[0]).toHaveValue('01/07/2026')
  expect(inputs[1]).toHaveValue('14/07/2026')

  await userEvent.click(screen.getAllByRole('button', { name: /lịch/ })[1])
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /20\/07\/2026/ }))

  expect(onToChange).toHaveBeenCalledWith('2026-07-20')
})

it('renders shared inline detail tabs with an end action', async () => {
  const onSelect = vi.fn()
  const onAnalyze = vi.fn()

  render(
    <ManagementInlineDetailTabs
      activeKey="info"
      ariaLabel="Chi tiết khách hàng"
      endAction={(
        <button aria-label="Xem phân tích" className="management-icon-button" type="button" onClick={onAnalyze}>
          Biểu đồ
        </button>
      )}
      tabs={[
        { key: 'info', label: 'Thông tin' },
        { key: 'debt', label: 'Nợ cần thu' },
      ]}
      onSelect={onSelect}
    />,
  )

  const tablist = screen.getByRole('tablist', { name: 'Chi tiết khách hàng' })
  expect(tablist.closest('.inline-detail-tabbar')).toContainElement(screen.getByRole('button', { name: 'Xem phân tích' }))
  expect(within(tablist).getByRole('tab', { name: 'Thông tin' })).toHaveAttribute('aria-selected', 'true')

  await userEvent.click(within(tablist).getByRole('tab', { name: 'Nợ cần thu' }))
  await userEvent.click(screen.getByRole('button', { name: 'Xem phân tích' }))

  expect(onSelect).toHaveBeenCalledWith('debt')
  expect(onAnalyze).toHaveBeenCalledTimes(1)
})

it('renders shared detail info list and inline note', () => {
  render(
    <section aria-label="Thông tin khách hàng">
      <ManagementDetailInfoList
        columns="four"
        items={[
          { label: 'MST', value: '0312345678' },
          { label: 'Người tạo', value: 'Chưa khớp tài khoản' },
        ]}
      />
      <ManagementDetailMetaText label="Nhóm khách:" value="Khách VIP" />
      <ManagementDetailInlineNote icon={<span data-testid="note-icon" />}>Ghi chú khách KV</ManagementDetailInlineNote>
    </section>,
  )

  const panel = screen.getByRole('region', { name: 'Thông tin khách hàng' })
  expect(within(panel).getByText('MST').closest('dl')).toHaveClass('management-detail-meta-grid', 'management-detail-meta-grid-four')
  expect(within(panel).getByText('MST')).toBeInTheDocument()
  expect(within(panel).getByText('MST')).toHaveClass('management-detail-meta-label')
  expect(within(panel).getByText('0312345678')).toBeInTheDocument()
  expect(within(panel).getByText('0312345678')).toHaveClass('management-detail-meta-value')
  expect(within(panel).getByText('Người tạo')).toBeInTheDocument()
  expect(within(panel).getByText('Chưa khớp tài khoản')).toBeInTheDocument()
  expect(within(panel).getByText('Nhóm khách:')).toHaveClass('management-detail-meta-label')
  expect(within(panel).getByText('Khách VIP')).toHaveClass('management-detail-meta-value')
  expect(within(panel).getByText('Ghi chú khách KV')).toHaveClass('management-detail-inline-note')
  expect(screen.getByTestId('note-icon')).toBeInTheDocument()
})

it('stacks every shared detail info item when one item cannot fit on one line', async () => {
  let resizeCallback: ResizeObserverCallback | null = null
  class MockResizeObserver {
    observe = vi.fn()
    disconnect = vi.fn()

    constructor(callback: ResizeObserverCallback) {
      resizeCallback = callback
    }
  }
  vi.stubGlobal('ResizeObserver', MockResizeObserver)

  render(
    <ManagementDetailInfoList
      columns="three"
      items={[
        { label: 'Người tạo:', value: 'Văn Lâm' },
        { label: 'Phương thức thanh toán', value: 'MBBank: 0947900909' },
        { label: 'Ghi chú', value: '-' },
      ]}
    />,
  )

  const grid = screen.getByText('Phương thức thanh toán').closest('dl') as HTMLElement
  const items = Array.from(grid.querySelectorAll(':scope > div')) as HTMLElement[]

  items.forEach((item, index) => {
    Object.defineProperty(item, 'clientWidth', { configurable: true, value: 240 })
    Object.defineProperty(item.querySelector('dt'), 'scrollWidth', { configurable: true, value: index === 1 ? 110 : 50 })
    Object.defineProperty(item.querySelector('dd'), 'scrollWidth', { configurable: true, value: index === 1 ? 100 : 60 })
  })

  act(() => {
    resizeCallback?.([], {} as ResizeObserver)
  })

  await waitFor(() => expect(grid).not.toHaveClass('management-detail-meta-grid-stacked'))

  Object.defineProperty(items[1], 'clientWidth', { configurable: true, value: 180 })

  act(() => {
    resizeCallback?.([], {} as ResizeObserver)
  })

  await waitFor(() => expect(grid).toHaveClass('management-detail-meta-grid-stacked'))

  vi.unstubAllGlobals()
})

it('renders shared detail shell blocks for page-specific content', () => {
  render(
    <ManagementDetailPanel className="custom-detail-panel">
      <ManagementDetailHeader
        title="Phiếu thu PT0001"
        endAction={<span data-testid="status-chip">Chưa thanh toán</span>}
      />
      <ManagementDetailSummary
        ariaLabel="Thông tin tạo khách hàng"
        code="KH000522"
        metaItems={[
          { label: 'Người tạo:', value: 'Văn Lâm' },
          { label: 'Ngày tạo:', value: '08/07/2026' },
          { label: 'Nhóm khách:', value: 'Chưa có' },
        ]}
        title="Lanh Hồ"
      />
      <ManagementDetailSection ariaLabel="Thông tin khách hàng" role="tabpanel">
        <p>Ruột dữ liệu</p>
      </ManagementDetailSection>
    </ManagementDetailPanel>,
  )

  const panel = screen.getByText('Ruột dữ liệu').closest('.management-detail-panel')
  expect(panel).toHaveClass('management-detail-panel', 'custom-detail-panel')
  expect(within(panel as HTMLElement).getByRole('heading', { name: 'Phiếu thu PT0001' })).toBeInTheDocument()
  expect(within(panel as HTMLElement).getByTestId('status-chip')).toHaveTextContent('Chưa thanh toán')
  const summary = within(panel as HTMLElement).getByRole('group', { name: 'Thông tin tạo khách hàng' })
  expect(summary).toHaveClass('management-detail-summary')
  expect(within(summary).getByRole('heading', { name: 'Lanh Hồ' })).toBeInTheDocument()
  expect(within(summary).getByText('KH000522')).toBeInTheDocument()
  expect(within(summary).getByText('Người tạo:')).toHaveClass('management-detail-meta-label')
  expect(within(summary).getByText('Văn Lâm')).toHaveClass('management-detail-meta-value')
  expect(within(panel as HTMLElement).getByRole('tabpanel', { name: 'Thông tin khách hàng' })).toHaveClass('management-detail-section')
})

it('renders shared editable detail note input', async () => {
  const onChange = vi.fn()
  render(
    <ManagementDetailNoteInput
      ariaLabel="Ghi chú hóa đơn"
      placeholder="Ghi chú..."
      value="Khách lấy sau"
      onChange={onChange}
    />,
  )

  const input = screen.getByRole('textbox', { name: 'Ghi chú hóa đơn' })
  expect(input).toHaveClass('management-detail-note')
  expect(input).toHaveValue('Khách lấy sau')

  await userEvent.type(input, ' thêm')
  expect(onChange).toHaveBeenCalled()
})

it('renders shared read-only detail note with fallback and icon', () => {
  render(
    <section aria-label="Ghi chú chi tiết">
      <ManagementDetailNote icon={<span data-testid="note-icon" />} value="  Ghi chú NCC  " />
      <ManagementDetailNote value="   " />
    </section>,
  )

  const panel = screen.getByRole('region', { name: 'Ghi chú chi tiết' })
  expect(within(panel).getByText('Ghi chú NCC')).toHaveClass('management-detail-inline-note')
  expect(screen.getByTestId('note-icon')).toBeInTheDocument()
  expect(within(panel).getByText('Chưa có ghi chú')).toHaveClass('management-detail-inline-note')
})
