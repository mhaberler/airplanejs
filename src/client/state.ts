import type { Map as LeafletMap } from 'leaflet'
import type { Aircraft } from './aircraft'
import type { Airline } from '../shared/types'

export const INITIAL_ZOOM_LEVEL = 9
export const POLL_INTERVAL = 2000
export const PRUNE_TIMEOUT = 120000
export const DEFAULT_CENTER: [number, number] = [50.468223, 3.081006]

/** Mutable client-side application state (mirrors the old module globals). */
export const state = {
  map: null as LeafletMap | null,
  selectedIcao: null as string | null,
  aircraft: new Map<string, Aircraft>(),
  airlines: {} as Record<string, Airline>,
  airportSize: {} as Record<string, number>,
  onSelect: null as ((icao: string) => void) | null,
  totalMessages: 0
}
