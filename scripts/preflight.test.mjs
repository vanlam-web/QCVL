import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

import { collectPreflightReport, requiredPreflightDocs } from './preflight.mjs'

describe('preflight docs gate', () => {
  test('checks compact current-state docs first', () => {
    expect(requiredPreflightDocs).toEqual([
      'docs/WORKER-START-HERE.md',
      'AI_TEAM_RULES.md',
      'docs/PROJECT-COORDINATION.md',
      'docs/DOCUMENT_RULES.md',
      'docs/CURRENT-DATA-SOURCE.md',
    ])
  })

  test('reports readable docs and no missing files in repo state', () => {
    const report = collectPreflightReport(process.cwd())

    expect(report.missing).toEqual([])
    expect(report.readable).toEqual(requiredPreflightDocs)
    expect(report.summary).toContain('WORKER-START-HERE.md')
    expect(report.summary).toContain('PROJECT-COORDINATION.md')
    expect(report.summary).toContain('CURRENT-DATA-SOURCE.md')
  })
})

describe('npm scripts gate', () => {
  test('routes main lifecycle scripts through preflight', () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))

    expect(packageJson.scripts.preflight).toBe('node scripts/preflight.mjs')
    expect(packageJson.scripts.pretest).toBe('npm run preflight')
    expect(packageJson.scripts.prebuild).toBe('npm run preflight')
    expect(packageJson.scripts['prebuild:nas']).toBe('npm run preflight')
    expect(packageJson.scripts.predeploy).toBe('npm run preflight')
    expect(packageJson.scripts['predeploy:nas']).toBe('npm run preflight')
  })
})
