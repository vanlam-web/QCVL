import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider } from './AuthProvider'
import { LoginPage } from './LoginPage'
import type { AuthService } from './auth-service'
import { ApiError } from '../../lib/api/client'

it('submits normalized login and password to the auth service', async () => {
  const signIn = vi.fn(async () => undefined)
  const service: AuthService = {
    signIn,
    signOut: async () => undefined,
    getAccessToken: async () => null,
  }
  render(
    <AuthProvider service={service}>
      <LoginPage />
    </AuthProvider>,
  )

  await userEvent.type(screen.getByLabelText('Tài khoản'), 'admin')
  await userEvent.type(screen.getByLabelText('Mật khẩu'), '123456')
  await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

  expect(signIn).toHaveBeenCalledWith('admin', '123456')
})

it('validates missing credentials before submitting', async () => {
  const signIn = vi.fn(async () => undefined)
  render(
    <AuthProvider
      service={{
        signIn,
        signOut: async () => undefined,
        getAccessToken: async () => null,
      }}
    >
      <LoginPage />
    </AuthProvider>,
  )

  await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Vui lòng nhập tài khoản và mật khẩu.')
  expect(signIn).not.toHaveBeenCalled()
})

it('toggles password visibility from the trailing eye button', async () => {
  render(
    <AuthProvider
      service={{
        signIn: vi.fn(async () => undefined),
        signOut: async () => undefined,
        getAccessToken: async () => null,
      }}
    >
      <LoginPage />
    </AuthProvider>,
  )

  const passwordInput = screen.getByLabelText('Mật khẩu')
  expect(passwordInput).toHaveAttribute('type', 'password')

  await userEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }))
  expect(passwordInput).toHaveAttribute('type', 'text')

  await userEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }))
  expect(passwordInput).toHaveAttribute('type', 'password')
})

it('shows login failure instead of expired session when credentials are rejected', async () => {
  render(
    <AuthProvider
      service={{
        signIn: vi.fn(async () => {
          throw new ApiError(401, 'LOGIN_FAILED', 'Invalid email or password.', 'trace')
        }),
        signOut: async () => undefined,
        getAccessToken: async () => null,
      }}
    >
      <LoginPage />
    </AuthProvider>,
  )

  await userEvent.type(screen.getAllByRole('textbox')[0], 'admin')
  await userEvent.type(document.querySelector('input[type="password"]') as HTMLInputElement, 'bad')
  await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Tên đăng nhập/SĐT hoặc mật khẩu không đúng.')
})

it('shows mapped API errors after authentication fails downstream', async () => {
  render(
    <AuthProvider
      service={{
        signIn: vi.fn(async () => {
          throw new ApiError(500, 'INTERNAL_ERROR', 'Server failed', 'trace')
        }),
        signOut: async () => undefined,
        getAccessToken: async () => null,
      }}
    >
      <LoginPage />
    </AuthProvider>,
  )

  await userEvent.type(screen.getByLabelText('Tài khoản'), 'admin')
  await userEvent.type(screen.getByLabelText('Mật khẩu'), '123456')
  await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Máy chủ gặp lỗi. Vui lòng thử lại sau.')
})
