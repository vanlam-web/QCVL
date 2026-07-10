#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const defaultApiBaseUrl = 'http://127.0.0.1:3100'

export function parseArgs(values) {
  const result = {
    apiBaseUrl: process.env.QCVL_DEV_API_BASE_URL ?? defaultApiBaseUrl,
    cleanupDemo: false,
    file: process.env.QCVL_DEV_KV_PRODUCTS_FILE ?? null,
    mode: 'import',
  }

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (value === '--api') result.apiBaseUrl = requireValue(values, ++index, value)
    else if (value === '--file') result.file = requireValue(values, ++index, value)
    else if (value === '--cleanup-demo') result.cleanupDemo = true
    else if (value === '--preview') result.mode = 'preview'
    else if (value === '--import') result.mode = 'import'
    else if (value === '--help') result.mode = 'help'
    else throw new Error(`Unknown argument: ${value}`)
  }

  return result
}

export function findLatestKiotVietProductFile(directory = join(homedir(), 'Downloads')) {
  if (!existsSync(directory)) return null
  const candidates = readdirSync(directory)
    .filter((name) => /^DanhSachSanPham_KV.*\.xlsx$/i.test(name))
    .map((name) => join(directory, name))
    .filter((file) => {
      try {
        return statSync(file).isFile()
      } catch {
        return false
      }
    })
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)

  return candidates[0] ?? null
}

export function buildImportBody(file, cleanupDemo) {
  return {
    cleanup_demo: cleanupDemo,
    file_base64: readFileSync(file).toString('base64'),
    file_name: basename(file),
  }
}

export async function seedKiotVietProducts(options, fetchImpl = fetch) {
  const file = options.file ? resolve(options.file) : findLatestKiotVietProductFile()
  if (!file) throw new Error('Missing file. Pass --file <xlsx> or put DanhSachSanPham_KV*.xlsx in Downloads.')
  if (!existsSync(file)) throw new Error(`File not found: ${file}`)

  const path = options.mode === 'preview'
    ? '/api/v1/products/import/kiotviet/preview'
    : '/api/v1/products/import/kiotviet'
  const response = await fetchImpl(`${trimSlash(options.apiBaseUrl)}${path}`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer dev',
      'content-type': 'application/json',
    },
    body: JSON.stringify(buildImportBody(file, options.cleanupDemo)),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`Import request failed ${response.status}: ${JSON.stringify(payload)}`)
  }

  const listResponse = await fetchImpl(`${trimSlash(options.apiBaseUrl)}/api/v1/products?status=active&page=1&page_size=15`, {
    headers: { authorization: 'Bearer dev' },
  })
  const listPayload = await listResponse.json().catch(() => null)

  return {
    file,
    mode: options.mode,
    summary: payload?.data?.summary ?? payload,
    list: {
      status: listResponse.status,
      total: listPayload?.data?.total ?? null,
      total_all: listPayload?.data?.total_all ?? null,
    },
  }
}

function requireValue(values, index, flag) {
  const value = values[index]
  if (!value) throw new Error(`Missing value for ${flag}`)
  return value
}

function trimSlash(value) {
  return value.replace(/\/+$/, '')
}

function printHelp() {
  console.log(`Usage: npm run dev:seed-products -- [options]

Options:
  --file <xlsx>       KiotViet product export. Default: newest DanhSachSanPham_KV*.xlsx in Downloads.
  --api <url>         API base URL. Default: ${defaultApiBaseUrl}
  --preview           Preview only.
  --import            Import data. Default.
  --cleanup-demo      Delete known demo products before import when safe.
`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.mode === 'help') {
    printHelp()
    return
  }

  const result = await seedKiotVietProducts(options)
  console.log(`File: ${result.file}`)
  console.log(`Mode: ${result.mode}`)
  console.log(JSON.stringify(result.summary, null, 2))
  console.log(JSON.stringify(result.list, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
