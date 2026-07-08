import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'

export async function getStaticResponse(url: URL, staticRoot: string) {
  const root = resolve(staticRoot)
  const requestedPath = decodeURIComponent(url.pathname)
  const filePath = await resolveStaticPath(root, requestedPath)

  if (!filePath) {
    return new Response('Not found', { status: 404 })
  }

  const body = await readFile(filePath)
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': contentType(filePath),
      'cache-control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000',
    },
  })
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
