import { FormEvent, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useAuthService } from './auth-context'
import { formatApiError } from '../../lib/api/error-message'
import { normalizeLogin } from './auth-presenter'

export function LoginPage() {
  const auth = useAuthService()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (login.trim().length === 0 || password.length === 0) {
      setError('Vui lòng nhập tài khoản và mật khẩu.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await auth.signIn(normalizeLogin(login), password)
    } catch (cause) {
      const fallback = cause instanceof Error ? cause.message : 'Đăng nhập không thành công.'
      setError(formatApiError(cause, fallback))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <form aria-label="Đăng nhập" noValidate onSubmit={submit}>
        <h1>
          <img alt="" className="auth-brand-logo" src="/brand-logo-128.png" />
          <span>QCVL</span>
        </h1>
        <label>
          Tài khoản
          <input placeholder="Tên đăng nhập hoặc SĐT" value={login} onChange={(event) => setLogin(event.target.value)} />
        </label>
        <label>
          Mật khẩu
          <span className="auth-password-field">
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? 'text' : 'password'}
            />
            <button
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="auth-password-toggle"
              onClick={() => setShowPassword((current) => !current)}
              type="button"
            >
              {showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
            </button>
          </span>
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button disabled={submitting} type="submit">
          Đăng nhập
        </button>
      </form>
    </main>
  )
}

