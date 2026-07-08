#!/usr/bin/env node
import process from 'node:process'
import { execFileSync } from 'node:child_process'

const args = parseArgs(process.argv.slice(2))

if (!args.file) {
  fail('Missing --file <xlsx>')
}

const dryRun = args.dryRun !== false
const rows = readXlsxRows(args.file)
if (rows.length === 0) fail('Excel file is empty')

const headers = rows[0].map((value) => normalizeHeader(value))
const records = rows.slice(1).map((row, index) => toRecord(headers, row, index + 2))
const mapped = records.map(mapKiotVietRow)
const valid = mapped.filter((item) => item.valid)
const invalid = mapped.filter((item) => !item.valid)
const summary = summarize(valid, invalid)

printSummary(summary)

if (dryRun) {
  printInvalid(invalid)
  process.exit(0)
}

const apiBaseUrl = process.env.VITE_API_BASE_URL
const email = process.env.KIOTVIET_IMPORT_EMAIL
const password = process.env.KIOTVIET_IMPORT_PASSWORD

if (!apiBaseUrl || !email || !password) {
  fail('Import mode requires VITE_API_BASE_URL, KIOTVIET_IMPORT_EMAIL, KIOTVIET_IMPORT_PASSWORD')
}

if (invalid.length > 0) {
  printInvalid(invalid)
  fail('Import stopped because invalid rows exist')
}

const token = await login(apiBaseUrl, email, password)
const groupIds = await importGroups(apiBaseUrl, token, valid)
await importProducts(apiBaseUrl, token, valid, groupIds)

console.log('Import completed. BOM/provisional stock rows are reported in dry-run and remain follow-up until public API supports bulk import.')

function parseArgs(values) {
  const result = { dryRun: true }
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (value === '--file') result.file = values[++index]
    else if (value === '--dry-run') result.dryRun = true
    else if (value === '--import') result.dryRun = false
    else if (value === '--no-dry-run') result.dryRun = false
    else fail(`Unknown argument: ${value}`)
  }
  return result
}

function readXlsxRows(file) {
  const sharedStrings = readSharedStrings(file)
  const sheetXml = unzipText(file, firstWorksheetEntry(file))
  const rows = []
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = []
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1]
      const body = cellMatch[2]
      const ref = attr(attrs, 'r')
      const columnIndex = ref === null ? row.length : columnToIndex(ref.replace(/\d+/g, ''))
      row[columnIndex] = readCellValue(attrs, body, sharedStrings)
    }
    rows.push(row)
  }
  return rows
}

function firstWorksheetEntry(file) {
  const listing = execFileSync('unzip', ['-Z1', file], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  const entry = listing
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /^xl\/worksheets\/sheet\d+\.xml$/.test(line))
  if (!entry) fail('No worksheet XML found in xlsx file')
  return entry
}

function readSharedStrings(file) {
  let xml = ''
  try {
    xml = unzipText(file, 'xl/sharedStrings.xml')
  } catch {
    return []
  }
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((textMatch) => decodeXml(textMatch[1])).join('')
  )
}

function readCellValue(attrs, body, sharedStrings) {
  const type = attr(attrs, 't')
  const valueMatch = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)
  if (type === 'inlineStr') {
    return [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join('')
  }
  if (valueMatch === null) return null
  const raw = decodeXml(valueMatch[1])
  if (type === 's') return sharedStrings[Number(raw)] ?? ''
  if (type === 'str') return raw
  const numberValue = Number(raw)
  return Number.isFinite(numberValue) ? numberValue : raw
}

function unzipText(file, entry) {
  return execFileSync('unzip', ['-p', file, entry], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 })
}

function attr(attrs, name) {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`))
  return match?.[1] ?? null
}

function columnToIndex(column) {
  return [...column].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1
}

function decodeXml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
}

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
}

function toRecord(headers, row, rowNumber) {
  const record = { rowNumber }
  headers.forEach((header, index) => {
    if (header.length > 0) record[header] = row[index]
  })
  return record
}

function mapKiotVietRow(record) {
  const code = text(record['ma hang'] ?? record['ma san pham'] ?? record['sku'])
  const name = text(record['ten hang'] ?? record['ten san pham'])
  const productKindRaw = text(record['loai hang'])
  const groupName = text(pick(record, 'nhom hang'))
  const baseUnitName = text(record['dvt'] ?? record['don vi tinh'] ?? record['ma dvt co ban'])
  const conversionUnitName = text(record['ma dvt co ban'] ?? record['don vi quy doi'])
  const conversionFactor = number(record['quy doi'])
  const latestPurchaseCost = number(record['gia von'])
  const salePrice = number(record['gia ban'])
  const provisionalStock = number(record['ton kho'])
  const bomText = text(pick(record, 'hang thanh phan') ?? pick(record, 'vat tu cau thanh'))
  const errors = []

  if (!code) errors.push('missing code')
  if (!name) errors.push('missing name')
  if (!baseUnitName) errors.push('missing unit')

  const productKind = mapProductKind(productKindRaw, bomText)
  const unitConversions = []
  if (conversionUnitName && conversionUnitName !== baseUnitName && conversionFactor !== null && conversionFactor > 0) {
    unitConversions.push({
      unit_name: conversionUnitName,
      stock_qty_per_unit: conversionFactor,
      is_default_purchase_unit: true,
      is_default_sale_unit: false,
    })
  }

  return {
    valid: errors.length === 0,
    rowNumber: record.rowNumber,
    errors,
    code,
    name,
    product_kind: productKind,
    product_group_name: groupName || 'Giá chung',
    unit_name: baseUnitName,
    latest_purchase_cost: latestPurchaseCost,
    sale_price: salePrice,
    provisional_stock: provisionalStock,
    unit_conversions: unitConversions,
    bom_text: bomText,
  }
}

function mapProductKind(value, bomText) {
  const normalized = normalizeHeader(value)
  if (bomText) return 'combo'
  if (normalized.includes('dich vu')) return 'service'
  if (normalized.includes('combo')) return 'combo'
  if (normalized.includes('vat tu phu')) return 'auxiliary_material'
  if (normalized.includes('cuon')) return 'roll'
  if (normalized.includes('tam')) return 'sheet'
  return 'goods'
}

function summarize(valid, invalid) {
  const counts = {
    total_rows: valid.length + invalid.length,
    valid_rows: valid.length,
    invalid_rows: invalid.length,
    goods: 0,
    service: 0,
    auxiliary_material: 0,
    roll: 0,
    sheet: 0,
    combo: 0,
    product_groups: new Set(),
    unit_conversions: 0,
    bom_rows: 0,
    provisional_stock_rows: 0,
  }

  for (const item of valid) {
    counts[item.product_kind] += 1
    counts.product_groups.add(item.product_group_name)
    counts.unit_conversions += item.unit_conversions.length
    if (item.bom_text) counts.bom_rows += 1
    if (item.provisional_stock !== null) counts.provisional_stock_rows += 1
  }

  return {
    ...counts,
    product_groups: [...counts.product_groups].sort(),
  }
}

function printSummary(summary) {
  console.log(JSON.stringify(summary, null, 2))
}

function printInvalid(invalid) {
  if (invalid.length === 0) return
  console.error('Invalid rows:')
  for (const item of invalid.slice(0, 50)) {
    console.error(`Row ${item.rowNumber}: ${item.errors.join(', ')}`)
  }
}

function pick(record, headerPrefix) {
  const key = Object.keys(record).find((item) => item === headerPrefix || item.startsWith(`${headerPrefix}(`))
  return key === undefined ? undefined : record[key]
}

async function importGroups(apiBaseUrl, token, items) {
  const existing = await apiRequest(apiBaseUrl, token, '/api/v1/product-groups')
  const groupIds = new Map(existing.items.map((group) => [group.name, group.id]))
  for (const name of [...new Set(items.map((item) => item.product_group_name))]) {
    if (groupIds.has(name)) continue
    const created = await apiRequest(apiBaseUrl, token, '/api/v1/product-groups', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    groupIds.set(created.name, created.id)
  }
  return groupIds
}

async function login(apiBaseUrl, email, password) {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const payload = await response.json().catch(() => null)
  const token = payload?.data?.access_token
  if (!response.ok || payload?.success === false || typeof token !== 'string') {
    fail(`Sign in failed: ${response.status} ${JSON.stringify(payload)}`)
  }
  return token
}

async function importProducts(apiBaseUrl, token, items, groupIds) {
  for (const item of items) {
    await apiRequest(apiBaseUrl, token, '/api/v1/products', {
      method: 'POST',
      body: JSON.stringify({
        code: item.code,
        name: item.name,
        product_kind: item.product_kind,
        unit_name: item.unit_name,
        latest_purchase_cost: item.latest_purchase_cost,
        product_group_id: groupIds.get(item.product_group_name),
        unit_conversions: item.unit_conversions,
      }),
    })
  }
}

async function apiRequest(apiBaseUrl, token, path, init = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.success === false) {
    throw new Error(`${init.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(payload)}`)
  }
  return payload.data
}

function text(value) {
  const result = String(value ?? '').trim()
  return result.length > 0 ? result : null
}

function number(value) {
  if (value === null || value === undefined || value === '') return null
  const result = Number(String(value).replaceAll(',', '').trim())
  return Number.isFinite(result) ? result : null
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
