#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { exec } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ViteDevServer } from 'vite'
import { AircraftStore } from './store.js'
import { Dump1090Client } from './dump1090.js'
import { add, match } from './router.js'
import { airlines, airports, routes } from './handlers/data.js'
import { aircrafts } from './handlers/aircrafts.js'
import { createStaticHandler } from './static.js'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const clientDir = resolve(rootDir, 'dist/client')

const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8')) as { version: string }

const args = parseCliArgs(process.argv.slice(2))

if (args.help) {
  help()
  process.exit(0)
}
if (args.version) {
  console.log(pkg.version)
  process.exit(0)
}

const store = new AircraftStore()
const dump1090 = new Dump1090Client(store)

const host = args.dump1090Host ?? 'adsb.local'
const dump1090Port = toPort(args.dump1090Port)
dump1090.start({ host, port: dump1090Port })

add('GET', '/airlines', airlines)
add('GET', '/airports', airports)
add('GET', '/routes', routes)
add('GET', '/aircrafts', aircrafts(store))

const staticHandler = createStaticHandler(clientDir)

// In development, serve the client through Vite middleware (HMR + TS on the fly).
let vite: ViteDevServer | null = null
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite')
  vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  })
}

const server = createServer((req: IncomingMessage, res: ServerResponse): void => {
  const pathname = (req.url ?? '/').split('?')[0]
  const route = match(req.method ?? 'GET', pathname)

  if (route) {
    route.handler(req, res, route.params)
    return
  }

  if (vite) {
    vite.middlewares(req, res, () => {})
  } else {
    staticHandler(req, res)
  }
})

process.on('SIGINT', () => {
  console.log('Stopping dump1090 connector...')
  dump1090.stop()
  process.exit()
})

const customPort = toPort(args.port)
server.listen(customPort ?? 0, () => {
  const address = server.address()
  const actualPort = typeof address === 'object' && address !== null ? address.port : customPort ?? 3000
  const url = `http://localhost:${actualPort}`

  if (!args.browser) {
    console.log('Server running at: %s', url)
  } else {
    console.log('Opening %s in your favorite browser...', url)
    openBrowser(url)
  }
})

// Prune stale aircraft from the store periodically.
setInterval(() => store.prune(), 60000)

interface CliArgs {
  help: boolean
  version: boolean
  dump1090Host?: string
  dump1090Port?: string
  port?: string
  browser: boolean
}

function parseCliArgs (argv: string[]): CliArgs {
  const args: CliArgs = { help: false, version: false, browser: true }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const value = (): string | undefined => argv[++i]

    switch (arg) {
      case '--help':
      case '-h':
        args.help = true
        break
      case '--version':
      case '-v':
        args.version = true
        break
      case '--no-browser':
        args.browser = false
        break
      case '--dump1090-host':
      case '-H':
        args.dump1090Host = value()
        break
      case '--dump1090-port':
      case '-P':
        args.dump1090Port = value()
        break
      case '--port':
      case '-p':
        args.port = value()
        break
      default: {
        // Support `--opt=value` form.
        const eq = arg.indexOf('=')
        if (arg.startsWith('--') && eq !== -1) {
          const key = arg.slice(0, eq)
          const val = arg.slice(eq + 1)
          if (key === '--dump1090-host') args.dump1090Host = val
          else if (key === '--dump1090-port') args.dump1090Port = val
          else if (key === '--port') args.port = val
        }
      }
    }
  }

  return args
}

function toPort (value: string | undefined): number | undefined {
  if (!value) return undefined
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

function openBrowser (url: string): void {
  const cmd = process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
      ? 'start'
      : 'xdg-open'
  exec(`${cmd} "${url}"`)
}

function help (): void {
  console.log('Usage:')
  console.log('  airplanejs [options]')
  console.log()
  console.log('Options:')
  console.log('  --help -h                    Show this help')
  console.log('  --version -v                 Output AirplaneJS version')
  console.log('  --dump1090-host -H <host>    dump1090 host (default: localhost)')
  console.log('  --dump1090-port -P <port>    dump1090 SBS port (default: 30003)')
  console.log('  --port -p <port>             Set custom HTTP server port (default: 3000)')
  console.log('  --no-browser                 Disable automatic opening of default browser')
}
