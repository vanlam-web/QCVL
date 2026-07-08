import { render, screen } from '@testing-library/react'
import { App } from './App'

it('renders the QCVL application name', async () => {
  render(<App />)
  expect(await screen.findByLabelText('Tài khoản')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'QCVL' })).toBeInTheDocument()
})
