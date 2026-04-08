'use strict'

const debug = require('debug')('airplanejs:store')

const PRUNE_TIMEOUT = 300000 // 5 minutes - remove aircraft not seen for this long

const aircraftMap = {}

exports.addAircraft = function (data) {
  const existing = aircraftMap[data.icao]

  if (existing) {
    // Update existing aircraft, only overwrite non-null values
    Object.keys(data).forEach(function (key) {
      if (data[key] !== null && data[key] !== undefined) {
        existing[key] = data[key]
      }
    })
    existing.count = (existing.count || 0) + 1
  } else {
    data.count = 1
    aircraftMap[data.icao] = data
    debug('New aircraft: %s (%s)', data.icao, data.callsign || 'unknown')
  }
}

exports.getAircrafts = function () {
  return Object.keys(aircraftMap).map(function (icao) {
    return aircraftMap[icao]
  })
}

exports.prune = function () {
  const threshold = Date.now() - PRUNE_TIMEOUT
  Object.keys(aircraftMap).forEach(function (icao) {
    if (aircraftMap[icao].seen < threshold) {
      debug('Pruning aircraft: %s', icao)
      delete aircraftMap[icao]
    }
  })
}
