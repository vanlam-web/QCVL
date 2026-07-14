import { validateNasHealthBody } from './health-nas-helpers.mjs'

const baseUrl = process.env.QCVL_NAS_BASE_URL ?? 'http://100.84.228.125:3200'
const healthUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/health`
const requiredPersistence = process.env.QCVL_NAS_REQUIRE_PERSISTENCE ?? 'postgres'
const timeoutMs = Number(process.env.QCVL_NAS_HEALTH_TIMEOUT_MS ?? '180000')
const intervalMs = Number(process.env.QCVL_NAS_HEALTH_INTERVAL_MS ?? '5000')
const deadline = Date.now() + timeoutMs

let lastResult = null

while (Date.now() <= deadline) {
  try {
    const response = await fetch(healthUrl)
    let body

    try {
      body = await response.json()
    } catch {
      body = null
    }

    const validation = validateNasHealthBody(body, requiredPersistence)
    lastResult = { body, reason: validation.reason, status: response.status }
    if (response.ok && validation.ok) {
      console.log(
        JSON.stringify(
          {
            persistence: body.data.persistence ?? null,
            status: 'ok',
            traceId: body.trace_id,
            url: healthUrl,
          },
          null,
          2,
        ),
      )
      process.exit(0)
    }
  } catch (error) {
    lastResult = { error: error instanceof Error ? error.message : String(error) }
  }

  await new Promise((resolve) => setTimeout(resolve, intervalMs))
}

console.error(JSON.stringify({ url: healthUrl, requiredPersistence, lastResult }, null, 2))
process.exit(1)
