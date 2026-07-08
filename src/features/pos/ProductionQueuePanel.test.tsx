import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductionQueuePanel } from './ProductionQueuePanel'
import type { ProductionQueueService } from '../production-queue/production-queue-service'
import type { ProductionQueueDraftPayload, ProductionQueueItem } from '../production-queue/types'

const queueItem: ProductionQueueItem = {
  id: 'queue-1',
  production_machine: { id: 'machine-1', code: 'IN-DECAL', name: 'In decal' },
  raw_file_name: 'KH000001_DECAL-PP_120x50_x2',
  received_at: '2026-07-01T10:30:00Z',
  status: 'queued',
  parse_status: 'ok',
  parse_error: null,
  parsed: { customer_code: 'KH000001', product_code: 'DECAL-PP' },
}

const draftPayload: ProductionQueueDraftPayload = {
  queue_item_id: 'queue-1',
  customer: { id: 'customer-1', code: 'KH000001', name: 'Khách lẻ' },
  draft_line: {
    product_id: 'p-2',
    product_code: 'DECAL-PP',
    product_name: 'Decal PP',
    unit_name: 'm²',
    sell_method: 'area_m2',
    width_m: 1.2,
    height_m: 0.5,
    linear_m: null,
    quantity: 2,
    source: 'production_queue',
  },
}

function makeService(overrides: Partial<ProductionQueueService> = {}): ProductionQueueService {
  return {
    listQueue: vi.fn(async () => ({ items: [queueItem], page: 1, page_size: 20, total: 1 })),
    listHistory: vi.fn(async () => ({ items: [], page: 1, page_size: 20, total: 0 })),
    addToDraft: vi.fn(async () => draftPayload),
    dismiss: vi.fn(),
    restore: vi.fn(),
    ...overrides,
  }
}

it('lists production machine queue items and adds one to the local draft', async () => {
  const service = makeService()
  const onAddToDraft = vi.fn()

  render(<ProductionQueuePanel service={service} onAddToDraft={onAddToDraft} />)

  const panel = await screen.findByLabelText('K02-D hàng đợi máy sản xuất')
  expect(within(panel).queryByText('KH000001_DECAL-PP_120x50_x2')).not.toBeInTheDocument()

  await userEvent.click(within(panel).getByRole('button', { name: /In decal/ }))

  expect(within(panel).getByRole('list')).toHaveClass('production-queue-popover')
  expect(within(panel).queryByText(/Đang mở:/)).not.toBeInTheDocument()
  expect(within(panel).getByText('KH000001_DECAL-PP_120x50_x2')).toBeInTheDocument()
  expect(within(panel).getByText('IN-DECAL - In decal')).toBeInTheDocument()

  await userEvent.click(
    within(panel).getByRole('button', { name: 'Thêm KH000001_DECAL-PP_120x50_x2 vào nháp' }),
  )

  expect(service.addToDraft).toHaveBeenCalledWith('queue-1')
  expect(onAddToDraft).toHaveBeenCalledWith(draftPayload)
  expect(within(panel).queryByText('KH000001_DECAL-PP_120x50_x2')).not.toBeInTheDocument()
})

it('only shows machine count badges when a machine has notifications', async () => {
  const service = makeService()
  const onAddToDraft = vi.fn()

  render(<ProductionQueuePanel service={service} onAddToDraft={onAddToDraft} />)

  const decalButton = await screen.findByRole('button', { name: /In decal\s*1/ })
  const bannerButton = screen.getByRole('button', { name: /^In bạt$/ })

  expect(within(decalButton).getByText('1')).toBeInTheDocument()
  expect(within(bannerButton).queryByText('0')).not.toBeInTheDocument()
})

it('shows machine button labels by default while preserving accessible count names', async () => {
  const service = makeService()
  const onAddToDraft = vi.fn()

  render(<ProductionQueuePanel service={service} onAddToDraft={onAddToDraft} />)

  const tabs = await screen.findByLabelText('Máy sản xuất')

  expect(within(tabs).getByRole('button', { name: 'In bạt' })).toBeInTheDocument()
  expect(within(tabs).getByRole('button', { name: /In decal 1/ })).toBeInTheDocument()
  expect(within(tabs).getByText('1')).toBeInTheDocument()
  expect(within(tabs).getByText('In bạt')).toHaveClass('production-machine-label')
  expect(within(tabs).getByText('In decal')).toHaveClass('production-machine-label')
  expect(within(tabs).getByText('Cắt CNC')).toHaveClass('production-machine-label')
})

it('uses a banner printer asset icon for banner printing', async () => {
  const service = makeService()
  const onAddToDraft = vi.fn()

  render(<ProductionQueuePanel service={service} onAddToDraft={onAddToDraft} />)

  const bannerButton = await screen.findByRole('button', { name: 'In bạt' })
  const icon = bannerButton.querySelector('[data-icon="banner-printer"]') as HTMLElement

  expect(bannerButton.querySelector('svg')).not.toBeInTheDocument()
  expect(icon).toHaveClass('production-machine-mask-icon')
  expect(icon).toHaveStyle({ width: '30px', height: '30px' })
  expect(icon.style.getPropertyValue('--machine-icon-url')).toContain('inbat.svg')
})

it('uses a decal printer asset icon for decal printing', async () => {
  const service = makeService()
  const onAddToDraft = vi.fn()

  render(<ProductionQueuePanel service={service} onAddToDraft={onAddToDraft} />)

  const decalButton = await screen.findByRole('button', { name: /In decal 1/ })
  const icon = decalButton.querySelector('[data-icon="decal-printer"]') as HTMLElement

  expect(decalButton.querySelector('svg')).not.toBeInTheDocument()
  expect(icon).toHaveClass('production-machine-mask-icon')
  expect(icon).toHaveStyle({ width: '30px', height: '30px' })
  expect(icon.style.getPropertyValue('--machine-icon-url')).toContain('indc.svg')
})

it('uses a cnc router icon for CNC cutting', async () => {
  const service = makeService({
    listQueue: vi.fn(async () => ({
      items: [
        {
          ...queueItem,
          id: 'queue-cnc',
          production_machine: { id: 'machine-cnc', code: 'CNC-01', name: 'Máy CNC 01' },
          raw_file_name: 'bang-hieu-an-phat.cdr',
        },
      ],
      page: 1,
      page_size: 20,
      total: 1,
    })),
  })
  const onAddToDraft = vi.fn()

  render(<ProductionQueuePanel service={service} onAddToDraft={onAddToDraft} />)

  const cncButton = await screen.findByRole('button', { name: /Cắt CNC 1/ })
  const icon = cncButton.querySelector('[data-icon="cnc-router"]') as HTMLElement

  expect(cncButton.querySelector('svg')).not.toBeInTheDocument()
  expect(icon).toHaveClass('production-machine-mask-icon')
  expect(icon).toHaveStyle({ width: '30px', height: '30px' })
  expect(icon.style.getPropertyValue('--machine-icon-url')).toContain('cnc.svg')
})

it('keeps the notification popover open when the pointer only moves away', async () => {
  const service = makeService()
  const onAddToDraft = vi.fn()

  render(<ProductionQueuePanel service={service} onAddToDraft={onAddToDraft} />)

  const panel = await screen.findByLabelText('K02-D hàng đợi máy sản xuất')
  await userEvent.click(within(panel).getByRole('button', { name: /In decal/ }))
  expect(within(panel).getByRole('list')).toHaveClass('production-queue-popover')

  fireEvent.mouseLeave(panel)
  fireEvent.pointerMove(document.body)

  expect(within(panel).getByRole('list')).toHaveClass('production-queue-popover')
})

it('closes the notification popover when selecting outside the panel', async () => {
  const service = makeService()
  const onAddToDraft = vi.fn()

  render(<ProductionQueuePanel service={service} onAddToDraft={onAddToDraft} />)

  const panel = await screen.findByLabelText('K02-D hàng đợi máy sản xuất')
  await userEvent.click(within(panel).getByRole('button', { name: /In decal/ }))
  expect(within(panel).getByRole('list')).toHaveClass('production-queue-popover')

  fireEvent.pointerDown(document.body)

  expect(within(panel).queryByRole('list')).not.toBeInTheDocument()
})
