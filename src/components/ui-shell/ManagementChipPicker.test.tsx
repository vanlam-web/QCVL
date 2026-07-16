import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { ManagementChipPicker } from './ManagementChipPicker'

it('filters chip options without Vietnamese accents', async () => {
  render(
    <ManagementChipPicker
      addLabel="Chọn bảng giá"
      ariaLabel="Chọn cột bảng giá"
      options={[
        { id: 'default', label: 'Bảng giá chung' },
        { id: 'vip', label: 'Giá VIP' },
      ]}
      selectedOptions={[]}
      unselectedOptions={[
        { id: 'default', label: 'Bảng giá chung' },
        { id: 'vip', label: 'Giá VIP' },
      ]}
      onAdd={vi.fn()}
      onRemove={vi.fn()}
    />,
  )

  const picker = screen.getByLabelText('Chọn cột bảng giá')
  const search = within(picker).getByRole('textbox', { name: 'Chọn bảng giá' })

  await userEvent.type(search, 'bang gia')

  expect(within(picker).getByRole('option', { name: 'Bảng giá chung' })).toBeInTheDocument()
  expect(within(picker).queryByRole('option', { name: 'Giá VIP' })).not.toBeInTheDocument()
})
