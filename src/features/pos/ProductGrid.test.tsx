import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductGrid } from './ProductGrid'
import type { Product, ResolvedPrice } from '../catalog/types'

function product(index: number): Product {
  return {
    id: `p-${index}`,
    code: `SP-${index.toString().padStart(2, '0')}`,
    name: `Sản phẩm ${index}`,
    status: 'active',
    unit_name: 'cái',
    sell_method: 'quantity',
  }
}

function pricesFor(products: Product[]): Record<string, ResolvedPrice> {
  return Object.fromEntries(
    products.map((item, index) => [
      item.id,
      {
        product_id: item.id,
        unit_price: (index + 1) * 1000,
        price_source: 'default_price_list',
        price_list_id: 'pl-1',
      },
    ]),
  )
}

it('renders active products and selects one', async () => {
  const onSelectProduct = vi.fn()
  render(
    <ProductGrid
      products={[
        {
          id: 'p-1',
          code: 'MICA-3MM',
          name: 'Mica 3mm',
          status: 'active',
          unit_name: 'm',
          sell_method: 'linear_m',
        },
      ]}
      prices={{
        'p-1': {
          product_id: 'p-1',
          unit_price: 120000,
          price_source: 'default_price_list',
          price_list_id: 'pl-1',
        },
      }}
      loading={false}
      onSelectProduct={onSelectProduct}
    />,
  )

  expect(screen.getByText('Mica 3mm')).toBeInTheDocument()
  expect(screen.getByText('120 000/m')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'MICA-3MM Mica 3mm 120 000/m' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Mica 3mm/ }))
  expect(onSelectProduct).toHaveBeenCalledWith(expect.objectContaining({ id: 'p-1' }))
})

it('shows an empty state when no active product is available', () => {
  render(<ProductGrid products={[]} prices={{}} loading={false} onSelectProduct={vi.fn()} />)
  expect(screen.getByText('Chưa có sản phẩm đang bán.')).toBeInTheDocument()
})

it('hides placeholder unit text on quick product cards', () => {
  const noUnitProduct = { ...product(1), unit_name: 'Cần cập nhật' }
  render(
    <ProductGrid
      products={[noUnitProduct]}
      prices={pricesFor([noUnitProduct])}
      loading={false}
      onSelectProduct={vi.fn()}
    />,
  )

  expect(screen.getByText('1 000')).toBeInTheDocument()
  expect(screen.queryByText(/Cần cập nhật/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /SP-01.*1 000/ })).toBeInTheDocument()
})

it('paginates quick products by 12 items per page', async () => {
  const products = Array.from({ length: 13 }, (_, index) => product(index + 1))
  render(
    <ProductGrid
      products={products}
      prices={pricesFor(products)}
      loading={false}
      onSelectProduct={vi.fn()}
    />,
  )

  expect(screen.getByRole('button', { name: 'SP-01 Sản phẩm 1 1 000/cái' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'SP-13 Sản phẩm 13 13 000/cái' })).not.toBeInTheDocument()
  expect(screen.getByText('1/2')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Trang trước sản phẩm nhanh' })).toBeDisabled()

  await userEvent.click(screen.getByRole('button', { name: 'Trang sau sản phẩm nhanh' }))

  expect(screen.getByRole('button', { name: 'SP-13 Sản phẩm 13 13 000/cái' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'SP-01 Sản phẩm 1 1 000/cái' })).not.toBeInTheDocument()
  expect(screen.getByText('2/2')).toBeInTheDocument()
})
