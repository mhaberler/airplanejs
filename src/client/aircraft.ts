import * as L from 'leaflet'
import type { AircraftDTO, AltitudeUnit } from '../shared/types'

export interface AircraftContext {
  map: L.Map
  isSelected: boolean
  onSelect: (icao: string) => void
  onInfo: (aircraft: Aircraft) => void
}

/** Client-side aircraft state: data, flight trail, and Leaflet layers. */
export class Aircraft {
  readonly icao: string
  callsign?: string
  lat?: number
  lng?: number
  altitude?: number | 'ground'
  unit?: AltitudeUnit
  heading: number | null = null
  speed: number | null = null
  squawk?: string
  rssi?: number
  category?: string
  vertRate?: number
  messages?: number
  emergency?: string
  seen: number
  count: number

  trailCoords: Array<[number, number]> = []
  marker: L.Marker | null = null
  trail: L.Polyline | null = null

  constructor (icao: string) {
    this.icao = icao
    this.seen = Date.now()
    this.count = 0
  }

  /** Merge a new poll's data and append the position to the trail. */
  apply (data: AircraftDTO): void {
    this.callsign = data.callsign ?? this.callsign
    this.lat = data.lat
    this.lng = data.lng
    this.altitude = data.altitude
    this.unit = data.unit
    this.heading = data.heading
    this.speed = data.speed
    this.squawk = data.squawk
    this.rssi = data.rssi
    this.category = data.category
    this.vertRate = data.vertRate
    this.messages = data.messages ?? this.messages ?? 0
    this.emergency = data.emergency
    this.seen = data.seen ?? Date.now()
    this.count = data.count ?? this.count + 1

    if (this.lat !== undefined && this.lng !== undefined) {
      this.trailCoords.push([this.lat, this.lng])
      // Keep the trail bounded.
      if (this.trailCoords.length > 500) {
        this.trailCoords = this.trailCoords.slice(-300)
      }
    }
  }

  altitudeColor (): string {
    if (this.altitude === null || this.altitude === undefined || this.altitude === 'ground') {
      return '#8b949e'
    }
    const alt = this.altitude
    if (alt < 1000) return '#3fb950'
    if (alt < 5000) return '#58a6ff'
    if (alt < 15000) return '#d29922'
    if (alt < 30000) return '#f0883e'
    if (alt < 40000) return '#f85149'
    return '#bc8cff'
  }

  /** (Re)draw the marker and trail using the current state. */
  render (ctx: AircraftContext): void {
    const { map, isSelected, onSelect, onInfo } = ctx
    const pos: [number, number] = [this.lat ?? 0, this.lng ?? 0]
    const rotation = this.heading ?? 0
    const color = this.altitudeColor()

    const iconHtml =
      `<div class="plane-marker${isSelected ? ' selected' : ''}" style="transform:rotate(${rotation}deg);color:${color}">` +
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>' +
      '</div>'

    const icon = L.divIcon({
      className: 'aircraft-div-icon',
      html: iconHtml,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })

    if (this.marker) {
      this.marker.setLatLng(pos)
      this.marker.setIcon(icon)
    } else {
      this.marker = L.marker(pos, { icon, zIndexOffset: 1000 }).addTo(map)
      this.marker.on('click', () => onSelect(this.icao))
    }

    const tooltipText = this.callsign ?? this.icao
    this.marker.unbindTooltip()
    this.marker.bindTooltip(tooltipText, {
      className: 'aircraft-tooltip',
      direction: 'top',
      offset: [0, -14],
      permanent: false
    })

    if (isSelected) {
      if (this.trail) {
        this.trail.setLatLngs(this.trailCoords)
      } else {
        this.trail = L.polyline(this.trailCoords, {
          color,
          weight: 2,
          opacity: 0.7,
          dashArray: '4 6'
        }).addTo(map)
      }
      onInfo(this)
    } else if (this.trail) {
      map.removeLayer(this.trail)
      this.trail = null
    }
  }
}
