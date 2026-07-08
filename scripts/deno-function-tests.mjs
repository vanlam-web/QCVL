import { spawn } from 'node:child_process'
import process from 'node:process'

const defaultFunctionTestPath = 'supabase/tests/functions'

export function buildDenoFunctionTestArgs(paths) {
  return ['deno', 'test', '--allow-env', '--allow-net', ...(paths.length > 0 ? paths : [defaultFunctionTestPath])]
}

export async function runDenoFunctionTests(paths) {
  const [command, ...args] = buildDenoFunctionTestArgs(paths)
  const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })

  return await new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? 1))
    child.on('error', () => resolve(1))
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await runDenoFunctionTests(process.argv.slice(2))
}
