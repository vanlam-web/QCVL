import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const requiredPreflightDocs = [
  'docs/WORKER-START-HERE.md',
  'docs/AI/README.md',
  'AI_TEAM_RULES.md',
  'docs/PROJECT-COORDINATION.md',
  'docs/DOCUMENT_RULES.md',
  'docs/CURRENT-DATA-SOURCE.md',
]

export function resolveTeamAiBoardPath(env = process.env) {
  const teamAiDir = env.QCVL_TEAMAI_DIR ?? 'Y:\\TeamAI'
  return join(teamAiDir, 'WORKER-NOW.md')
}

function firstHeading(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith('# '))
}

function readDocSummary(baseDir, relativePath) {
  const absolutePath = join(baseDir, relativePath)
  if (!existsSync(absolutePath)) {
    return { ok: false, path: relativePath, heading: null }
  }

  const content = readFileSync(absolutePath, 'utf8')
  return { ok: true, path: relativePath, heading: firstHeading(content) ?? '(no heading)' }
}

function readTeamAiBoard(env) {
  const boardPath = resolveTeamAiBoardPath(env)
  const required = env.CI !== 'true'

  if (!required) {
    return { ok: true, path: boardPath, required, heading: 'skipped in CI' }
  }

  if (!existsSync(boardPath)) {
    return { ok: false, path: boardPath, required, heading: null }
  }

  const content = readFileSync(boardPath, 'utf8')
  return { ok: true, path: boardPath, required, heading: firstHeading(content) ?? '(no heading)' }
}

export function collectPreflightReport(baseDir = process.cwd(), options = {}) {
  const env = options.env ?? process.env
  const docs = requiredPreflightDocs.map((relativePath) => readDocSummary(baseDir, relativePath))
  const readable = docs.filter((doc) => doc.ok).map((doc) => doc.path)
  const teamAi = readTeamAiBoard(env)
  const missing = [
    ...docs.filter((doc) => !doc.ok).map((doc) => doc.path),
    ...(teamAi.required && !teamAi.ok ? [teamAi.path] : []),
  ]
  const summary = [
    'QCVL preflight docs:',
    ...docs.map((doc) => `- ${doc.path}: ${doc.ok ? doc.heading : 'MISSING'}`),
    `TeamAI board: ${teamAi.ok ? teamAi.heading : 'MISSING'} (${teamAi.path})`,
    '',
    'Worker rules:',
    '- Run git pull --ff-only before editing.',
    '- Read and update the TeamAI board before taking scope.',
    '- State scope before editing so inside-LAN and outside-LAN Codex do not overlap.',
    '- Read feature docs tied to touched page/API before changing behavior.',
    '- PostgreSQL on NAS is runtime source of truth; do not revive RAM/Supabase paths.',
  ].join('\n')

  return { docs, readable, missing, summary, teamAi }
}

function run() {
  const report = collectPreflightReport()
  console.log(report.summary)

  if (report.missing.length > 0) {
    console.error(`Missing required preflight docs: ${report.missing.join(', ')}`)
    process.exit(1)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run()
}
