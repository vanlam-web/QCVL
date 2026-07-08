import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, ThemeToggle } from './ThemeProvider'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

it('defaults to light theme and toggles dark theme with persistence', async () => {
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )

  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  expect(screen.getByRole('button', { name: 'Đổi sang giao diện tối' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Đổi sang giao diện tối' }))

  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  expect(localStorage.getItem('qc-oms-theme')).toBe('dark')
  expect(screen.getByRole('button', { name: 'Đổi sang giao diện sáng' })).toBeInTheDocument()
})
