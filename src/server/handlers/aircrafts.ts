import type { AircraftDTO } from '../../shared/types.js'
import type { AircraftStore } from '../store.js'
import type { Handler } from '../router.js'

export function aircrafts (store: AircraftStore): Handler {
  return (req, res): void => {
    const list: AircraftDTO[] = store
      .list()
      // Only plot aircraft that have a geolocation.
      .filter((aircraft) => aircraft.lat !== undefined && aircraft.lng !== undefined)
      .map((aircraft) => ({
        icao: aircraft.icao,
        count: aircraft.count,
        seen: aircraft.seen,
        lat: aircraft.lat,
        lng: aircraft.lng,
        altitude: aircraft.altitude,
        unit: aircraft.unit,
        heading: aircraft.heading !== undefined ? Math.round(aircraft.heading) : null,
        speed: aircraft.speed !== undefined ? Math.round(aircraft.speed) : null,
        callsign: aircraft.callsign,
        squawk: aircraft.squawk,
        rssi: aircraft.rssi,
        category: aircraft.category,
        vertRate: aircraft.vertRate,
        messages: aircraft.messages,
        emergency: aircraft.emergency
      }))

    const body = JSON.stringify(list)
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Length', String(Buffer.byteLength(body)))
    res.end(body)
  }
}
