import { act, renderHook } from '@testing-library/react'
import { useChipSelection } from './use-chip-selection'

it('keeps locked selected ids when options change', () => {
  const { result, rerender } = renderHook(
    ({ options }) => useChipSelection({
      options,
      initialSelectedIds: ['a'],
      lockedSelectedIds: ['b'],
    }),
    { initialProps: { options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] } },
  )

  expect(result.current.selectedIds).toEqual(['b', 'a'])

  rerender({ options: [{ id: 'b', label: 'B' }, { id: 'c', label: 'C' }] })

  expect(result.current.selectedIds).toEqual(['b'])
})

it('adds and removes unlocked chips without duplicating ids', () => {
  const { result } = renderHook(() => useChipSelection({
    options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    initialSelectedIds: ['a'],
  }))

  act(() => {
    result.current.addChip('b')
    result.current.addChip('b')
  })
  expect(result.current.selectedIds).toEqual(['a', 'b'])

  act(() => {
    result.current.removeChip('a')
  })
  expect(result.current.selectedIds).toEqual(['b'])
})
