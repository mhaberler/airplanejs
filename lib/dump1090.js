'use strict'

const net = require('net')
const debug = require('debug')('airplanejs')
const store = require('./store')

const DEFAULT_HOST = 'localhost'
const DEFAULT_PORT = 30003 // SBS/BaseStation port

let client = null
let reconnectTimer = null
let buffer = ''

exports.start = function (argv) {
  if (client) throw new Error('Cannot start dump1090 connector more than once')

  const host = argv['dump1090-host'] || argv.H || DEFAULT_HOST
  const port = argv['dump1090-port'] || argv.P || DEFAULT_PORT

  console.log('📡 Connexion à dump1090 sur %s:%d (SBS/BaseStation)...', host, port)

  connect(host, port)
}

exports.stop = function () {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (client) {
    client.destroy()
    client = null
  }
  debug('Stopped dump1090 connector')
}

function connect (host, port) {
  client = new net.Socket()

  client.connect(port, host, function () {
    console.log('✅ Connecté à dump1090 sur %s:%d', host, port)
  })

  client.on('data', function (data) {
    buffer += data.toString()

    // Process complete lines
    const lines = buffer.split('\n')
    // Keep the last incomplete line in the buffer
    buffer = lines.pop()

    lines.forEach(function (line) {
      line = line.trim()
      if (line.length > 0) {
        parseSBSMessage(line)
      }
    })
  })

  client.on('close', function () {
    console.log('⚠️  Connexion à dump1090 perdue. Reconnexion dans 5s...')
    client = null
    reconnectTimer = setTimeout(function () {
      connect(host, port)
    }, 5000)
  })

  client.on('error', function (err) {
    console.error('❌ Erreur de connexion à dump1090 sur %s:%d: %s', host, port, err.message)
  })
}

// SBS/BaseStation format:
// MSG,msgType,sessionId,aircraftId,hexIdent,flightId,dateGen,timeGen,dateLog,timeLog,
//   callsign,altitude,groundSpeed,track,lat,lon,verticalRate,squawk,alert,emergency,spi,isOnGround
function parseSBSMessage (line) {
  const parts = line.split(',')

  if (parts[0] !== 'MSG') return
  if (parts.length < 22) return

  const icao = parts[4] ? parts[4].trim().toUpperCase() : null
  if (!icao) return

  const msgType = parseInt(parts[1], 10)

  const aircraft = {
    icao: icao,
    seen: Date.now()
  }

  // MSG type 1: Identification (callsign)
  // MSG type 2: Surface position
  // MSG type 3: Airborne position
  // MSG type 4: Airborne velocity
  // MSG type 5: Surveillance altitude
  // MSG type 6: Surveillance squawk
  // MSG type 7: Air-to-air
  // MSG type 8: All-call

  const callsign = parts[10] ? parts[10].trim() : null
  if (callsign) aircraft.callsign = callsign

  const altitude = parts[11] ? parseInt(parts[11], 10) : null
  if (altitude !== null && !isNaN(altitude)) {
    aircraft.altitude = altitude
    aircraft.unit = 0 // feet
  }

  const speed = parts[12] ? parseFloat(parts[12]) : null
  if (speed !== null && !isNaN(speed)) aircraft.speed = Math.round(speed)

  const heading = parts[13] ? parseFloat(parts[13]) : null
  if (heading !== null && !isNaN(heading)) aircraft.heading = Math.round(heading)

  const lat = parts[14] ? parseFloat(parts[14]) : null
  const lon = parts[15] ? parseFloat(parts[15]) : null
  if (lat !== null && !isNaN(lat) && lon !== null && !isNaN(lon)) {
    aircraft.lat = lat
    aircraft.lng = lon
  }

  const vertRate = parts[16] ? parseInt(parts[16], 10) : null
  if (vertRate !== null && !isNaN(vertRate)) aircraft.vertRate = vertRate

  const squawk = parts[17] ? parts[17].trim() : null
  if (squawk) aircraft.squawk = squawk

  const isOnGround = parts[21] ? parts[21].trim() === '-1' : false
  if (isOnGround) aircraft.altitude = 'ground'

  store.addAircraft(aircraft)
}
