import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'vitest'

import { collectPreflightReport, requiredPreflightDocs, resolveTeamAiBoardPath } from './preflight.mjs'

describe('preflight docs gate', () => {
  test('checks compact current-state docs first', () => {
    expect(requiredPreflightDocs).toEqual([
      'docs/WORKER-START-HERE.md',
      'docs/AI/README.md',
      'AI_TEAM_RULES.md',
      'docs/PROJECT-COORDINATION.md',
      'docs/DOCUMENT_RULES.md',
      'docs/CURRENT-DATA-SOURCE.md',
    ])
  })

  test('reports readable docs and no missing files in repo state', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'qcvl-teamai-'))
    try {
      writeFileSync(join(tempDir, 'WORKER-NOW.md'), '# TeamAI Worker Now\n\n- Status: ready\n', 'utf8')
      const report = collectPreflightReport(process.cwd(), {
        env: { QCVL_TEAMAI_DIR: tempDir },
      })

      expect(report.missing).toEqual([])
      expect(report.readable).toEqual(requiredPreflightDocs)
      expect(report.summary).toContain('WORKER-START-HERE.md')
      expect(report.summary).toContain('PROJECT-COORDINATION.md')
      expect(report.summary).toContain('CURRENT-DATA-SOURCE.md')
      expect(report.summary).toContain('TeamAI board:')
    } finally {
      rmSync(tempDir, { force: true, recursive: true })
    }
  })

  test('requires shared TeamAI work board outside CI', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'qcvl-teamai-'))
    try {
      const report = collectPreflightReport(process.cwd(), {
        env: { QCVL_TEAMAI_DIR: tempDir },
      })

      expect(report.teamAi.required).toBe(true)
      expect(report.teamAi.ok).toBe(false)
      expect(report.missing).toContain(join(tempDir, 'WORKER-NOW.md'))
    } finally {
      rmSync(tempDir, { force: true, recursive: true })
    }
  })

  test('passes shared TeamAI work board when the board exists', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'qcvl-teamai-'))
    try {
      writeFileSync(join(tempDir, 'WORKER-NOW.md'), '# TeamAI Worker Now\n\n- Status: test\n', 'utf8')

      const report = collectPreflightReport(process.cwd(), {
        env: { QCVL_TEAMAI_DIR: tempDir },
      })

      expect(report.teamAi).toMatchObject({
        ok: true,
        path: join(tempDir, 'WORKER-NOW.md'),
        required: true,
      })
      expect(report.summary).toContain('TeamAI board:')
      expect(report.missing).not.toContain(join(tempDir, 'WORKER-NOW.md'))
    } finally {
      rmSync(tempDir, { force: true, recursive: true })
    }
  })

  test('skips shared TeamAI work board in CI only', () => {
    const report = collectPreflightReport(process.cwd(), {
      env: { CI: 'true', QCVL_TEAMAI_DIR: join(tmpdir(), 'missing-teamai-board') },
    })

    expect(report.teamAi.required).toBe(false)
    expect(report.teamAi.ok).toBe(true)
    expect(report.summary).toContain('TeamAI board: skipped in CI')
  })

  test('uses Y drive TeamAI folder as default board location', () => {
    expect(resolveTeamAiBoardPath({})).toBe(join('Y:\\TeamAI', 'WORKER-NOW.md'))
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
