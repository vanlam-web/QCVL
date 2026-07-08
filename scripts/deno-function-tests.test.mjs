import { describe, expect, test } from 'vitest'
import { buildDenoFunctionTestArgs } from './deno-function-tests.mjs'

describe('Deno function test runner args', () => {
  test('runs all function tests by default', () => {
    expect(buildDenoFunctionTestArgs([])).toEqual([
      'deno',
      'test',
      '--allow-env',
      '--allow-net',
      'supabase/tests/functions',
    ])
  })

  test('runs only requested function test paths when provided', () => {
    expect(buildDenoFunctionTestArgs(['supabase/tests/functions/health_test.ts'])).toEqual([
      'deno',
      'test',
      '--allow-env',
      '--allow-net',
      'supabase/tests/functions/health_test.ts',
    ])
  })
})
