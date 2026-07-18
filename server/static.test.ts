import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, test } from 'vitest'
import { getStaticResponse } from './static'

const root = join(tmpdir(), `qc-oms-static-${process.pid}`)

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('getStaticResponse', () => {
  test('serves React index.html for unknown browser routes', async () => {
    await mkdir(root, { recursive: true })
    await writeFile(join(root, 'index.html'), '<main>QC OMS</main>')

    const response = await getStaticResponse(new URL('http://app.local/pos'), root)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    await expect(response.text()).resolves.toContain('QC OMS')
  })

  test('gzips large text assets when the browser accepts gzip', async () => {
    await mkdir(join(root, 'assets'), { recursive: true })
    const body = `const dashboard = ${JSON.stringify('finance '.repeat(5000))};`
    await writeFile(join(root, 'assets', 'app.js'), body)

    const plain = await getStaticResponse(new URL('http://app.local/assets/app.js'), root)
    const zipped = await getStaticResponse(new URL('http://app.local/assets/app.js'), root, {
      'accept-encoding': 'gzip, deflate, br',
    })

    expect(plain.headers.get('content-encoding')).toBeNull()
    expect(zipped.headers.get('content-encoding')).toBe('gzip')
    expect(Number(zipped.headers.get('content-length'))).toBeLessThan(Number(plain.headers.get('content-length')))
    expect(zipped.headers.get('cache-control')).toContain('immutable')
  })

  test('returns 304 when static etag matches', async () => {
    await mkdir(root, { recursive: true })
    await writeFile(join(root, 'index.html'), '<main>QC OMS</main>')
    const first = await getStaticResponse(new URL('http://app.local/dashboard'), root)
    const etag = first.headers.get('etag')

    const second = await getStaticResponse(new URL('http://app.local/dashboard'), root, {
      'if-none-match': etag ?? '',
    })

    expect(etag).toEqual(expect.any(String))
    expect(second.status).toBe(304)
    await expect(second.text()).resolves.toBe('')
  })
})
