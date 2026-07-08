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
})
