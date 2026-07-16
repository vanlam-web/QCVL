import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, ThemeToggle } from './ThemeProvider'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

it('defaults to dark theme and toggles light theme with persistence', async () => {
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )

  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  expect(screen.getByRole('button', { name: 'Đổi sang giao diện sáng' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Đổi sang giao diện sáng' }))

  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  expect(localStorage.getItem('qc-oms-theme')).toBe('light')
  expect(screen.getByRole('button', { name: 'Đổi sang giao diện tối' })).toBeInTheDocument()
})

it('keeps saved light theme on reload', () => {
  localStorage.setItem('qc-oms-theme', 'light')

  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )

  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
})
