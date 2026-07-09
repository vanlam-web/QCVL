const baseUrl = process.env.QCVL_NAS_BASE_URL ?? 'http://100.84.228.125:3200'
const healthUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/health`

const response = await fetch(healthUrl)
let body

try {
  body = await response.json()
} catch {
  body = null
}

if (!response.ok || body?.success !== true || body?.data?.status !== 'ok') {
  console.error(JSON.stringify({ url: healthUrl, status: response.status, body }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({ url: healthUrl, status: 'ok', traceId: body.trace_id }, null, 2))
