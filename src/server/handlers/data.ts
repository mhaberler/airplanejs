import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Airline, Airport, Route } from '../../shared/types.js'
import { streamCSV } from '../csv.js'
import type { Handler } from '../router.js'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const dataDir = resolve(rootDir, 'data')

export const airlines: Handler = (req, res): void => {
  streamCSV<Airline>(
    res,
    resolve(dataDir, 'airlines.csv'),
    ['id', 'name', 'alias', 'IATA', 'ICAO', 'callsign', 'country', 'active'],
    (row) => {
      const active = row.active === 'Y'
      // Defunct airlines are not flying planes — skip them.
      if (!active) return null
      return {
        id: Number.parseInt(row.id ?? '', 10),
        name: row.name,
        alias: row.alias,
        IATA: row.IATA,
        ICAO: row.ICAO,
        callsign: row.callsign,
        country: row.country,
        active
      }
    }
  )
}

export const airports: Handler = (req, res): void => {
  streamCSV<Airport>(
    res,
    resolve(dataDir, 'airports.csv'),
    ['id', 'name', 'city', 'country', 'IATA', 'ICAO', 'lat', 'lng', 'altitude', 'utcOffset', 'DST', 'tz', 'type', 'source'],
    (row) => ({
      id: Number.parseInt(row.id ?? '', 10),
      name: row.name,
      city: row.city,
      country: row.country,
      IATA: row.IATA,
      ICAO: row.ICAO,
      lat: row.lat !== null ? Number.parseFloat(row.lat) : null,
      lng: row.lng !== null ? Number.parseFloat(row.lng) : null,
      altitude: row.altitude !== null ? Number.parseInt(row.altitude, 10) : null,
      utcOffset: row.utcOffset !== null ? Number.parseFloat(row.utcOffset) : null,
      DST: row.DST,
      tz: row.tz,
      type: row.type,
      source: row.source
    })
  )
}

export const routes: Handler = (req, res): void => {
  streamCSV<Route>(
    res,
    resolve(dataDir, 'routes.csv'),
    ['airline', 'airlineId', 'source', 'sourceId', 'dest', 'destId', 'codeshare', 'stops', 'equipment'],
    (row) => ({
      airline: row.airline,
      airlineId: Number.parseInt(row.airlineId ?? '', 10),
      source: row.source,
      sourceId: Number.parseInt(row.sourceId ?? '', 10),
      dest: row.dest,
      destId: Number.parseInt(row.destId ?? '', 10),
      codeshare: row.codeshare === 'Y',
      stops: Number.parseInt(row.stops ?? '', 10),
      equipment: row.equipment
    })
  )
}
