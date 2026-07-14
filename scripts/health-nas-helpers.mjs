export function validateNasHealthBody(body, requiredPersistence) {
  if (body?.success !== true) return { ok: false, reason: 'response success is not true' }
  if (body?.data?.status !== 'ok') return { ok: false, reason: 'health status is not ok' }
  if (requiredPersistence && body?.data?.persistence !== requiredPersistence) {
    return {
      ok: false,
      reason: `expected persistence ${requiredPersistence}, got ${body?.data?.persistence ?? 'missing'}`,
    }
  }
  return { ok: true }
}
