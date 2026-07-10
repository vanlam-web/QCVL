import { mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { buildImportBody, findLatestKiotVietProductFile, parseArgs } from './dev-seed-kiotviet-products.mjs'

describe('dev KiotViet product seed script', () => {
  test('defaults to local API import without demo cleanup', () => {
    expect(parseArgs([])).toEqual({
      apiBaseUrl: 'http://127.0.0.1:3100',
      cleanupDemo: false,
      file: null,
      mode: 'import',
    })
  })

  test('supports explicit API, file, cleanup and preview mode', () => {
    expect(parseArgs(['--api', 'http://127.0.0.1:3199', '--file', 'C:/data/products.xlsx', '--cleanup-demo', '--preview'])).toEqual({
      apiBaseUrl: 'http://127.0.0.1:3199',
      cleanupDemo: true,
      file: 'C:/data/products.xlsx',
      mode: 'preview',
    })
  })

  test('finds newest KiotViet product file in a directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qcvl-kv-products-'))
    const older = join(dir, 'DanhSachSanPham_KV09072026-215404-812.xlsx')
    const newer = join(dir, 'DanhSachSanPham_KV10072026-003130-608.xlsx')
    writeFileSync(older, 'older')
    writeFileSync(newer, 'newer')
    utimesSync(older, new Date('2026-07-09T21:54:04'), new Date('2026-07-09T21:54:04'))
    utimesSync(newer, new Date('2026-07-10T00:31:30'), new Date('2026-07-10T00:31:30'))

    expect(findLatestKiotVietProductFile(dir)).toBe(newer)
  })

  test('builds server-side xlsx import request body', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qcvl-kv-body-'))
    const file = join(dir, 'DanhSachSanPham_KV.xlsx')
    writeFileSync(file, 'abc')

    expect(buildImportBody(file, true)).toEqual({
      cleanup_demo: true,
      file_base64: Buffer.from('abc').toString('base64'),
      file_name: 'DanhSachSanPham_KV.xlsx',
    })
  })
})
