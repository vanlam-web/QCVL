import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { RequirePermission } from './RequirePermission'

function renderGuard(props: { authenticated: boolean; pending?: boolean; permissions: `perm.${string}`[] }) {
  render(
    <MemoryRouter initialEntries={['/pos']}>
      <Routes>
        <Route
          path="/pos"
          element={
            <RequirePermission permission="perm.create_order" {...props}>
              <div>POS content</div>
            </RequirePermission>
          }
        />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/forbidden" element={<div>Forbidden page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

it('redirects unauthenticated users to login', () => {
  renderGuard({ authenticated: false, permissions: [] })
  expect(screen.getByText('Login page')).toBeInTheDocument()
})

it('redirects authenticated users without permission to forbidden', () => {
  renderGuard({ authenticated: true, permissions: [] })
  expect(screen.getByText('Forbidden page')).toBeInTheDocument()
})

it('renders children for authorized users and never while pending', () => {
  const { rerender } = render(
    <MemoryRouter>
      <RequirePermission authenticated pending permissions={['perm.create_order']} permission="perm.create_order">
        <div>POS content</div>
      </RequirePermission>
    </MemoryRouter>,
  )
  expect(screen.queryByText('POS content')).not.toBeInTheDocument()

  rerender(
    <MemoryRouter>
      <RequirePermission authenticated permissions={['perm.create_order']} permission="perm.create_order">
        <div>POS content</div>
      </RequirePermission>
    </MemoryRouter>,
  )
  expect(screen.getByText('POS content')).toBeInTheDocument()
})
