#!/usr/bin/env node
'use strict'

const url = require('url')
const http = require('http')
const { exec } = require('child_process')
const debug = require('debug')('airplanejs')
const getPort = require('get-port')
const patterns = require('patterns')()
const dump1090 = require('./lib/dump1090')
const routes = require('./lib/routes')

process.on('SIGINT', exit)

const argv = require('minimist')(process.argv.slice(2))

if (argv.help || argv.h) {
  help()
  process.exit()
}
if (argv.version || argv.v) {
  console.log(require('./package').version)
  process.exit()
}

// Start dump1090 connector
dump1090.start(argv)

patterns.add('GET /', routes.index)
patterns.add('GET /assets/{file}', routes.assets)
patterns.add('GET /airlines', routes.airlines)
patterns.add('GET /airports', routes.airports)
patterns.add('GET /routes', routes.routes)
patterns.add('GET /aircrafts', routes.aircrafts)

const server = http.createServer(function (req, res) {
  debug('%s %s', req.method, req.url)

  const path = url.parse(req.url).pathname
  const match = patterns.match(req.method + ' ' + path)

  if (!match) {
    res.writeHead(404)
    res.end()
    return
  }

  const fn = match.value // expects the value to be a function
  req.params = match.params

  fn(req, res)
})

const customPort = argv.port || argv.p

if (customPort) listen(customPort)
else getPort({port: 3000}).then(listen)

function listen (port) {
  server.listen(port, function () {
    const url = 'http://localhost:' + port
    if (argv.browser === false) {
      console.log('Server running at: %s', url)
    } else {
      console.log('Opening %s in your favorite browser...', url)
      openBrowser(url)
    }
  })
}

function help () {
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

function openBrowser (url) {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open'
  exec(cmd + ' ' + url)
}

function exit () {
  console.log('Stopping dump1090 connector...')
  dump1090.stop()
  process.exit()
}
