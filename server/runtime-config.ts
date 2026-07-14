export function databaseUrlFromEnv(env: NodeJS.ProcessEnv) {
  if (env.DATABASE_URL) return env.DATABASE_URL
  if (!env.POSTGRES_DB || !env.POSTGRES_USER || !env.POSTGRES_PASSWORD) return undefined

  const host = env.POSTGRES_HOST ?? 'postgres'
  const port = env.POSTGRES_PORT ?? '5432'
  return `postgres://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@${host}:${port}/${encodeURIComponent(env.POSTGRES_DB)}`
}
