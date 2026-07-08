import { chromium } from '@playwright/test'

const baseUrl = process.env.QCVL_SMOKE_BASE_URL ?? 'http://100.84.228.125:3200'
const loginName = process.env.QCVL_SMOKE_USER ?? 'admin'
const password = process.env.QCVL_SMOKE_PASSWORD
const forbiddenApiPort = '100.84.228.125:3100'
const routes = ['/pos', '/products', '/customers', '/finance', '/sales-documents']

if (!password) {
  throw new Error('QCVL_SMOKE_PASSWORD is required for NAS smoke test.')
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const failures = []
const apiCalls = []

page.on('request', (request) => {
  const url = request.url()
  if (!url.includes('/api/')) return
  apiCalls.push({ method: request.method(), url })
  if (url.includes(forbiddenApiPort)) {
    failures.push({
      type: 'wrong-api-port',
      url,
      detail: `Browser must call NAS public port ${baseUrl}, not ${forbiddenApiPort}.`,
    })
  }
})

page.on('requestfailed', (request) => {
  const url = request.url()
  if (!url.includes('/api/')) return
  failures.push({
    type: 'request-failed',
    url,
    detail: request.failure()?.errorText ?? 'unknown request failure',
  })
})

page.on('response', async (response) => {
  const url = response.url()
  if (!url.includes('/api/')) return
  if (response.status() < 400) return

  let body = ''
  try {
    body = await response.text()
  } catch {
    body = '<unreadable body>'
  }
  failures.push({
    type: 'api-response',
    status: response.status(),
    url,
    body: body.slice(0, 800),
  })
})

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.fill('input:not([type="password"])', loginName)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(2_000)

  for (const route of routes) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(2_000)
    const bodyText = await page.locator('body').innerText().catch(() => '')
    if (bodyText.includes('Máy chủ gặp lỗi') || bodyText.includes('Mã lỗi:')) {
      failures.push({
        type: 'visible-server-error',
        url: page.url(),
        body: bodyText.slice(0, 800),
      })
    }
  }

  if (failures.length > 0) {
    console.error(JSON.stringify({ baseUrl, routes, apiCalls, failures }, null, 2))
    process.exitCode = 1
  } else {
    console.log(JSON.stringify({ baseUrl, routes, apiCallCount: apiCalls.length, status: 'ok' }, null, 2))
  }
} finally {
  await browser.close()
}
