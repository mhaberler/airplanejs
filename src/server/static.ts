import { createReadStream, statSync } from 'node:fs'
import { normalize, resolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { lookup } from './mime.js'

export type StaticHandler = (req: IncomingMessage, res: ServerResponse) => void

/**
 * Serve static files from a directory (used in production for the built
 * Vite client). In development the Vite middleware handles this instead.
 */
export function createStaticHandler (clientDir: string): StaticHandler {
  return (req: IncomingMessage, res: ServerResponse): void => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    let pathname = decodeURIComponent(url.pathname)
    if (pathname === '/') pathname = '/index.html'

    const filePath = normalize(resolve(clientDir, '.' + pathname))
    if (filePath !== clientDir && !filePath.startsWith(clientDir + sep)) {
      res.writeHead(403)
      res.end()
      return
    }

    try {
      const stats = statSync(filePath)
      if (!stats.isFile()) {
        res.writeHead(404)
        res.end()
        return
      }

      res.setHeader('Content-Type', lookup(filePath))
      res.setHeader('Content-Length', String(stats.size))
      // Vite content-hashes files under /assets/, so they can be cached forever;
      // index.html must be revalidated so new builds are picked up.
      res.setHeader(
        'Cache-Control',
        pathname.startsWith('/assets/')
          ? 'public, max-age=31536000, immutable'
          : 'no-cache'
      )
      createReadStream(filePath).pipe(res)
    } catch {
      res.writeHead(404)
      res.end()
    }
  }
}
