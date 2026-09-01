import type { Aircraft } from '../shared/types.js'
import { createLogger } from './logger.js'

const PRUNE_TIMEOUT = 300000 // 5 minutes — remove aircraft not seen for this long

const logger = createLogger('store')

export type AircraftInput = Partial<Aircraft> & { icao: string }

/** In-memory store of live aircraft keyed by ICAO hex address. */
export class AircraftStore {
  private readonly aircraft = new Map<string, Aircraft>()

  add (data: AircraftInput): void {
    const existing = this.aircraft.get(data.icao)

    if (existing) {
      // Update existing aircraft, only overwriting non-null values.
      for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined) {
          ;(existing as unknown as Record<string, unknown>)[key] = value
        }
      }
      existing.count = (existing.count || 0) + 1
    } else {
      this.aircraft.set(data.icao, { ...data, count: 1 } as Aircraft)
      logger.debug('New aircraft: %s (%s)', data.icao, data.callsign ?? 'unknown')
    }
  }

  list (): Aircraft[] {
    return Array.from(this.aircraft.values())
  }

  prune (): void {
    const threshold = Date.now() - PRUNE_TIMEOUT
    for (const [icao, aircraft] of this.aircraft) {
      if (aircraft.seen < threshold) {
        this.aircraft.delete(icao)
        logger.debug('Pruning aircraft: %s', icao)
      }
    }
  }
}
