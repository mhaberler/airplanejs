import net from 'node:net'
import type { AircraftStore, AircraftInput } from './store.js'
import { createLogger, type Logger } from './logger.js'

const DEFAULT_HOST = 'adsb.local'
const DEFAULT_PORT = 30003 // SBS/BaseStation port

export interface Dump1090Options {
  host?: string
  port?: number
}

/** TCP client for a dump1090 SBS/BaseStation feed. */
export class Dump1090Client {
  private client: net.Socket | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private buffer = ''
  private readonly logger: Logger

  constructor (private readonly store: AircraftStore, logger?: Logger) {
    this.logger = logger ?? createLogger('dump1090')
  }

  start (opts: Dump1090Options): void {
    if (this.client) throw new Error('Cannot start dump1090 connector more than once')

    const host = opts.host ?? DEFAULT_HOST
    const port = opts.port ?? DEFAULT_PORT

    console.log('📡 Connexion à dump1090 sur %s:%d (SBS/BaseStation)...', host, port)
    this.connect(host, port)
  }

  stop (): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.client) {
      this.client.destroy()
      this.client = null
    }
    this.logger.debug('Stopped dump1090 connector')
  }

  private connect (host: string, port: number): void {
    const client = new net.Socket()
    this.client = client

    client.connect(port, host, () => {
      console.log('✅ Connecté à dump1090 sur %s:%d', host, port)
    })

    client.on('data', (data: Buffer) => {
      this.buffer += data.toString()

      // Process complete lines, keeping the last incomplete line buffered.
      const lines = this.buffer.split('\n')
      this.buffer = lines.pop() ?? ''

      for (const raw of lines) {
        const line = raw.trim()
        if (line.length > 0) {
          const aircraft = parseSBSMessage(line)
          if (aircraft) this.store.add(aircraft)
        }
      }
    })

    client.on('close', () => {
      console.log('⚠️  Connexion à dump1090 perdue. Reconnexion dans 5s...')
      this.client = null
      this.reconnectTimer = setTimeout(() => this.connect(host, port), 5000)
    })

    client.on('error', (err) => {
      console.error('❌ Erreur de connexion à dump1090 sur %s:%d: %s', host, port, err.message)
    })
  }
}

/**
 * Parse one SBS/BaseStation line.
 *
 * Format:
 * MSG,msgType,sessionId,aircraftId,hexIdent,flightId,dateGen,timeGen,dateLog,timeLog,
 *   callsign,altitude,groundSpeed,track,lat,lon,verticalRate,squawk,alert,emergency,spi,isOnGround
 */
export function parseSBSMessage (line: string): AircraftInput | null {
  const parts = line.split(',')

  if (parts[0] !== 'MSG') return null
  if (parts.length < 22) return null

  const icao = parts[4] ? parts[4].trim().toUpperCase() : ''
  if (!icao) return null

  const aircraft: AircraftInput = { icao, seen: Date.now() }

  const callsign = parts[10] ? parts[10].trim() : ''
  if (callsign) aircraft.callsign = callsign

  const altitude = parts[11] ? Number.parseInt(parts[11], 10) : Number.NaN
  if (!Number.isNaN(altitude)) {
    aircraft.altitude = altitude
    aircraft.unit = 0 // feet
  }

  const speed = parts[12] ? Number.parseFloat(parts[12]) : Number.NaN
  if (!Number.isNaN(speed)) aircraft.speed = Math.round(speed)

  const heading = parts[13] ? Number.parseFloat(parts[13]) : Number.NaN
  if (!Number.isNaN(heading)) aircraft.heading = Math.round(heading)

  const lat = parts[14] ? Number.parseFloat(parts[14]) : Number.NaN
  const lon = parts[15] ? Number.parseFloat(parts[15]) : Number.NaN
  if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
    aircraft.lat = lat
    aircraft.lng = lon
  }

  const vertRate = parts[16] ? Number.parseInt(parts[16], 10) : Number.NaN
  if (!Number.isNaN(vertRate)) aircraft.vertRate = vertRate

  const squawk = parts[17] ? parts[17].trim() : ''
  if (squawk) aircraft.squawk = squawk

  const isOnGround = parts[21] ? parts[21].trim() === '-1' : false
  if (isOnGround) aircraft.altitude = 'ground'

  return aircraft
}
