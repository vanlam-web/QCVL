export function normalizeLogin(value: string) {
  const login = value.trim().toLowerCase()
  return login.includes('@') ? login : `${login}@qc-oms.local`
}
