// ============================
// AirplaneJS — Shared types
// ============================

/** Altitude unit used by dump1090 SBS messages: 0 = feet, 1 = meters */
export type AltitudeUnit = 0 | 1

export interface Airline {
  id: number
  name: string | null
  alias: string | null
  IATA: string | null
  ICAO: string | null
  callsign: string | null
  country: string | null
  active: boolean
}

export interface Airport {
  id: number
  name: string | null
  city: string | null
  country: string | null
  IATA: string | null
  ICAO: string | null
  lat: number | null
  lng: number | null
  altitude: number | null
  utcOffset: number | null
  DST: string | null
  tz: string | null
  type: string | null
  source: string | null
}

export interface Route {
  airline: string | null
  airlineId: number | null
  source: string | null
  sourceId: number | null
  dest: string | null
  destId: number | null
  codeshare: boolean
  stops: number | null
  equipment: string | null
}

/** Live aircraft state as held in the in-memory store. */
export interface Aircraft {
  icao: string
  count: number
  seen: number
  lat?: number
  lng?: number
  altitude?: number | 'ground'
  unit?: AltitudeUnit
  heading?: number
  speed?: number
  callsign?: string
  squawk?: string
  rssi?: number
  category?: string
  vertRate?: number
  messages?: number
  emergency?: string
}

/** Shape returned by `GET /aircrafts` and consumed by the client. */
export interface AircraftDTO {
  icao: string
  count: number
  seen: number
  lat?: number
  lng?: number
  altitude?: number | 'ground'
  unit?: AltitudeUnit
  heading: number | null
  speed: number | null
  callsign?: string
  squawk?: string
  rssi?: number
  category?: string
  vertRate?: number
  messages?: number
  emergency?: string
}
