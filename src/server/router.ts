import type { IncomingMessage, ServerResponse } from 'node:http'

export type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>
) => void

interface Route {
  method: string
  pattern: string
  handler: Handler
}

const routes: Route[] = []

/** Register a route, e.g. `add('GET', '/assets/{file}', handler)`. */
export function add (method: string, pattern: string, handler: Handler): void {
  routes.push({ method, pattern, handler })
}

export interface Match {
  handler: Handler
  params: Record<string, string>
}

/** Match a request against registered routes, or return `null`. */
export function match (method: string, pathname: string): Match | null {
  for (const route of routes) {
    if (route.method !== method) continue
    const params = matchPattern(route.pattern, pathname)
    if (params) return { handler: route.handler, params }
  }
  return null
}

function matchPattern (pattern: string, pathname: string): Record<string, string> | null {
  const expected = pattern.split('/').filter(Boolean)
  const actual = pathname.split('/').filter(Boolean)

  if (expected.length !== actual.length) return null

  const params: Record<string, string> = {}
  for (let i = 0; i < expected.length; i++) {
    const part = expected[i]
    if (part.startsWith('{') && part.endsWith('}')) {
      params[part.slice(1, -1)] = decodeURIComponent(actual[i])
    } else if (part !== actual[i]) {
      return null
    }
  }
  return params
}
