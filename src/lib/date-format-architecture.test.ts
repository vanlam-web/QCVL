import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const featureRoot = join(process.cwd(), 'src', 'features')
const businessTimeFieldPattern = /\b(created_at|received_at|paid_at|adjusted_at)\s*:\s*[^,\n]*\.toISOString\(\)/g

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

describe('QCVL business datetime architecture', () => {
  it('does not serialize business time fields with Date.toISOString in feature code', () => {
    const offenders = sourceFiles(featureRoot).flatMap((file) => {
      const content = readFileSync(file, 'utf8')
      return [...content.matchAll(businessTimeFieldPattern)].map((match) => `${file}: ${match[0]}`)
    })

    expect(offenders).toEqual([])
  })
})
