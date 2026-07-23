import { describe, expect, test } from 'vitest'
import { assertSafeImageRef, imageRefFromEnvText, releaseIdFrom, releaseManifest } from './nas-release-helpers.mjs'

describe('NAS immutable image release helpers', () => {
  test('reads image ref without exposing unrelated environment values', () => {
    expect(imageRefFromEnvText('POSTGRES_PASSWORD=secret\nQCVL_APP_IMAGE_REF=qcvl-app:20260723090001-c3be67d\n')).toBe('qcvl-app:20260723090001-c3be67d')
  })

  test('allows only immutable QCVL image release tags', () => {
    expect(assertSafeImageRef('qcvl-app:20260723090001-c3be67d')).toBe('qcvl-app:20260723090001-c3be67d')
    expect(() => assertSafeImageRef('qcvl-app:latest')).toThrow('immutable')
    expect(() => assertSafeImageRef('busybox:latest')).toThrow('immutable')
    expect(() => assertSafeImageRef('qcvl-app:tag;rm')).toThrow('immutable')
  })

  test('records release identity without secrets', () => {
    const releaseId = releaseIdFrom({ now: new Date('2026-07-23T09:00:01.000Z'), commit: 'c3be67d12345' })
    expect(releaseManifest({ releaseId, commit: 'c3be67d12345', sourceDirty: false, imageRef: 'qcvl-app:20260723090001-c3be67d', imageId: 'sha256:test' })).toEqual({
      releaseId: '20260723090001-c3be67d12345',
      commit: 'c3be67d12345',
      builtAt: expect.any(String),
      sourceDirty: false,
      imageRef: 'qcvl-app:20260723090001-c3be67d',
      imageId: 'sha256:test',
    })
  })
})