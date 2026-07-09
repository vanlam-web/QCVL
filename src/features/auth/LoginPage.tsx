import { FormEvent, useState } from 'react'
import { useAuthService } from './auth-context'
import { formatApiError } from '../../lib/api/error-message'
import { normalizeLogin } from './auth-presenter'

export function LoginPage() {
  const auth = useAuthService()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
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
          <img alt="" className="auth-brand-logo" src="/brand-logo.png" />
          <span>QCVL</span>
        </h1>
        <label>
          Tài khoản
          <input value={login} onChange={(event) => setLogin(event.target.value)} />
        </label>
        <label>
          Mật khẩu
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button disabled={submitting} type="submit">
          Đăng nhập
        </button>
      </form>
    </main>
  )
}

