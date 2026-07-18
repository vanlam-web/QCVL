export function formatPhoneDisplay(phone: string | null | undefined, fallback = '') {
  const raw = phone?.trim()
  if (!raw) return fallback

  const digits = raw.replace(/\D/g, '')
  if (!digits) return fallback

  const normalized = digits.startsWith('0') ? digits : `0${digits}`
  if (normalized.length === 10) {
    return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`
  }
  if (normalized.length === 11) {
    return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`
  }
  return normalized
}
