import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { createPgRepository } from './db.js'
import { createDevMemoryRepository } from './dev-memory-repository.js'
import { createHttpHandler } from './http.js'
import { databaseUrlFromEnv } from './runtime-config.js'
import { getStaticResponse } from './static.js'

const port = Number(process.env.PORT ?? '3100')
const databaseUrl = databaseUrlFromEnv(process.env)
const devMemoryStateFile = process.env.QCVL_DEV_MEMORY_STATE_FILE ?? resolve('logs/dev-memory-state.json')

const repository = databaseUrl
  ? createPgRepository(databaseUrl)
  : await createDevMemoryRepository({ stateFile: devMemoryStateFile })
const handler = createHttpHandler({
  repository,
  persistence: databaseUrl ? 'postgres' : 'memory',
  version: process.env.npm_package_version ?? 'dev',
})
const staticRoot = resolve(process.env.STATIC_ROOT ?? 'dist')

const server = createServer(async (request, response) => {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const protocol = request.headers['x-forwarded-proto'] ?? 'http'
  const host = request.headers.host ?? `127.0.0.1:${port}`
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined
  const webRequest = new Request(`${protocol}://${host}${request.url ?? '/'}`, {
    method: request.method,
    headers: request.headers as HeadersInit,
    body,
  })
  const webResponse = request.url?.startsWith('/api/')
    ? await handler(webRequest)
    : await getStaticResponse(new URL(webRequest.url), staticRoot, webRequest.headers)

  response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()))
  if (webResponse.body) {
    response.end(Buffer.from(await webResponse.arrayBuffer()))
  } else {
    response.end()
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`qcvl-api listening on ${port}`)
})

async function shutdown() {
  server.close()
  await repository.close()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
