import { describe, expect, test } from 'vitest'
import { spawnSync } from 'node:child_process'

describe('public identity scanner', () => {
  test('rejects legacy QCVL identity outside technical allowlist', () => {
    const result = spawnSync(process.execPath, ['scripts/public-identity-scan.mjs'], { cwd: process.cwd(), encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('NO_PUBLIC_QCVL_LEGACY_IDENTITY')
  })
})
