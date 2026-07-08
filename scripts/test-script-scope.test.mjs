import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
const ciWorkflow = readFileSync(join(process.cwd(), '.github/workflows/ci.yml'), 'utf8')

describe('package test script scope', () => {
  test('runs source tests and repository helper unit tests', () => {
    expect(packageJson.scripts.test).toContain('src')
    expect(packageJson.scripts.test).toContain('scripts/*.test.mjs')
    expect(packageJson.scripts.test).toContain('tests/e2e/*.test.ts')
  })

  test('keeps Playwright config listing in CI quality checks', () => {
    expect(packageJson.scripts['test:e2e:list']).toBe('playwright test --list')
    expect(ciWorkflow).toContain('npm run test:e2e:list')
  })
})
