import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { gzip } from 'node:zlib'

const gzipAsync = promisify(gzip)
const minimumGzipBytes = 1024

type StaticFileCacheEntry = {
  body: Buffer
  gzipBody?: Buffer
  etag: string
  mtimeMs: number
  size: number
}

const staticFileCache = new Map<string, StaticFileCacheEntry>()

export async function getStaticResponse(url: URL, staticRoot: string, requestHeaders?: HeadersInit) {
  const root = resolve(staticRoot)
  const requestedPath = decodeURIComponent(url.pathname)
  const filePath = await resolveStaticPath(root, requestedPath)

  if (!filePath) {
    return new Response('Not found', { status: 404 })
  }

  const file = await cachedStaticFile(filePath)
  const headers = new Headers(requestHeaders)
  const responseHeaders = new Headers({
    'content-type': contentType(filePath),
    'cache-control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    etag: file.etag,
  })

  if (headers.get('if-none-match') === file.etag) {
    return new Response(null, { status: 304, headers: responseHeaders })
  }

  const useGzip = acceptsGzip(headers) && shouldGzip(filePath, file.body.length)
  const body = useGzip ? await cachedGzipBody(filePath, file) : file.body
  if (useGzip) {
    responseHeaders.set('content-encoding', 'gzip')
    responseHeaders.set('vary', 'accept-encoding')
  }
  responseHeaders.set('content-length', String(body.length))

  return new Response(bufferToArrayBuffer(body), {
    status: 200,
    headers: responseHeaders,
  })
}

function bufferToArrayBuffer(body: Buffer) {
  return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer
}

async function cachedStaticFile(filePath: string): Promise<StaticFileCacheEntry> {
  const metadata = await stat(filePath)
  const cached = staticFileCache.get(filePath)
  if (cached && cached.mtimeMs === metadata.mtimeMs && cached.size === metadata.size) return cached

  const body = await readFile(filePath)
  const entry: StaticFileCacheEntry = {
    body,
    etag: `"${metadata.size.toString(16)}-${Math.round(metadata.mtimeMs).toString(16)}"`,
    mtimeMs: metadata.mtimeMs,
    size: metadata.size,
  }
  staticFileCache.set(filePath, entry)
  return entry
}

async function cachedGzipBody(filePath: string, file: StaticFileCacheEntry) {
  if (file.gzipBody) return file.gzipBody
  const gzipBody = await gzipAsync(file.body)
  staticFileCache.set(filePath, { ...file, gzipBody })
  return gzipBody
}

function acceptsGzip(headers: Headers) {
  return headers.get('accept-encoding')?.split(',').some((part) => part.trim().toLowerCase().startsWith('gzip')) ?? false
}

function shouldGzip(path: string, byteLength: number) {
  return byteLength >= minimumGzipBytes && compressibleExtension(path)
}

function compressibleExtension(path: string) {
  switch (extname(path)) {
    case '.html':
    case '.js':
    case '.css':
    case '.json':
    case '.svg':
      return true
    default:
      return false
  }
}

async function resolveStaticPath(root: string, requestedPath: string) {
  const relativePath = normalize(requestedPath).replace(/^([/\\])+/, '')
  const directPath = resolve(join(root, relativePath))
  if (!isInside(root, directPath)) return null

  if (await isFile(directPath)) return directPath

  const indexPath = resolve(join(root, 'index.html'))
  if (!isInside(root, indexPath) || !(await isFile(indexPath))) return null
  return indexPath
}

async function isFile(path: string) {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

function isInside(root: string, path: string) {
  return path === root || path.startsWith(`${root}${sep}`)
}

function contentType(path: string) {
  switch (extname(path)) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    default:
      return 'application/octet-stream'
  }
}
