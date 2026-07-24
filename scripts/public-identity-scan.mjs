import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const legacyPattern = /qc-oms|qc_oms|qcoms/iu
const sourceRoots = ['src', 'public']
const allowedLegacyLines = new Map([
  ['src/components/ui-shell/ThemeProvider.tsx', [/^const storageKey = 'qc-oms-theme'$/]],
  ['src/features/auth/auth-service.ts', [/^const accessTokenStorageKey = 'qc_oms\.access_token'$/]],
  ['src/features/auth/AuthProvider.tsx', [/^const currentUserCacheKey = 'qc-oms\.auth\.current-user\.v2'$/]],
  ['src/features/pos/invoice-revision-handoff.ts', [/^const storageKey = 'qc_oms\.invoice_revision_payload'$/]],
  ['src/features/pos/pos-core.ts', [/^export const posDraftStorageKey = 'qc-oms\.pos\.invoice-tabs\.v1'$/]],
  ['src/features/pos/quote-draft-handoff.ts', [/^const storageKey = 'qc_oms\.quote_reopen_payload'$/]],
  ['src/features/purchase/PurchaseReceiptsPage.tsx', [
    /^const receiptCreateDraftStorageKey = 'qc-oms\.purchase-receipt-create-draft\.v1'$/,
    /^const receiptCreateDraftWindowNamePrefix = 'qc-oms\.purchase-receipt-create-draft='$/,
    /^const receiptCreateDraftHistoryStateKey = 'qc_oms_purchase_receipt_create_draft_v1'$/,
  ]],
  ['src/lib/api/client.ts', [/^const clientDeviceIdStorageKey = 'qc-oms\.client-device-id\.v1'$/]],
])

function filesUnder(directory, predicate) {
  const absolute = join(root, directory)
  const found = []
  function walk(current) {
    for (const name of readdirSync(current)) {
      const path = join(current, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (predicate(name)) found.push(path)
    }
  }
  walk(absolute)
  return found
}

function scanSource(paths) {
  const violations = []
  for (const path of paths) {
    const key = relative(root, path).replaceAll('\\', '/')
    const allowed = allowedLegacyLines.get(key) ?? []
    for (const [index, line] of readFileSync(path, 'utf8').split(/\r?\n/u).entries()) {
      if (legacyPattern.test(line) && !allowed.some((rule) => rule.test(line.trim()))) violations.push(`${key}:${index + 1}`)
    }
  }
  return violations
}

function scanDocs(paths) {
  const violations = []
  for (const path of paths) {
    const key = relative(root, path).replaceAll('\\', '/')
    if (legacyPattern.test(readFileSync(path, 'utf8'))) violations.push(key)
  }
  return violations
}

const sourceFiles = sourceRoots.flatMap((directory) => filesUnder(directory, (name) => /\.(?:ts|tsx|js|mjs|html|css)$/u.test(name) && !/\.test\.(?:ts|tsx|js|mjs)$/u.test(name)))
const docs = filesUnder('docs', (name) => name.endsWith('.md')).filter((path) => !path.endsWith('QCVL-IDENTITY-ALLOWLIST.md'))
const violations = { docs: scanDocs(docs), publicSource: scanSource(sourceFiles) }

if (violations.docs.length || violations.publicSource.length) {
  console.error(JSON.stringify(violations, null, 2))
  process.exit(1)
}
console.log('NO_PUBLIC_QCVL_LEGACY_IDENTITY')
