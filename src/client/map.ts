import * as L from 'leaflet'
import type { Airport } from '../shared/types'
import { DEFAULT_CENTER, INITIAL_ZOOM_LEVEL, state } from './state'

const VISIBILITY_THRESHOLDS: Array<number | null> = [
  null, 200, 150, 120, 100, 80, 60, 40, 20,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
]

export function initMap (): L.Map {
  const map = L.map('map', {
    center: DEFAULT_CENTER,
    zoom: INITIAL_ZOOM_LEVEL,
    zoomControl: true,
    attributionControl: true
  })

  state.map = map

  // Standard OSM tile layer.
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map)

  map.addControl(new LocationControl())

  injectMarkerStyles()

  // Try geolocation on load (silent).
  tryGeolocation(true)

  const homeIcon = L.divIcon({
    className: 'home-icon',
    html: '<div class="home-marker">🏠</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  })
  L.marker(DEFAULT_CENTER, { icon: homeIcon, zIndexOffset: 500, interactive: false }).addTo(map)
    .bindTooltip('Station de réception', {
      className: 'aircraft-tooltip',
      direction: 'top',
      offset: [0, -10],
      permanent: false
    })

  return map
}

let airportsList: Array<Airport & { lat: number; lng: number }> = []
const airportMarkers = new Map<number, L.Marker>()

export function plotAirports (airports: Airport[]): void {
  const map = state.map
  if (!map) return

  airportsList = airports.filter(
    (airport): airport is Airport & { lat: number; lng: number } =>
      airport.lat !== null && airport.lng !== null
  )

  map.on('zoomend', renderAirports)
  renderAirports()
}

function renderAirports (): void {
  const map = state.map
  if (!map) return

  const threshold = VISIBILITY_THRESHOLDS[map.getZoom()] ?? null

  airportsList.forEach((airport, index) => {
    const size = state.airportSize[airport.IATA ?? ''] ?? 0
    const visible = threshold === null ? true : size > threshold
    const existing = airportMarkers.get(index)

    if (visible && !existing) {
      airportMarkers.set(index, createAirportMarker(map, airport))
    } else if (!visible && existing) {
      map.removeLayer(existing)
      airportMarkers.delete(index)
    }
  })
}

function createAirportMarker (map: L.Map, airport: Airport & { lat: number; lng: number }): L.Marker {
  const icon = L.divIcon({
    className: 'airport-icon',
    html: '<svg width="12" height="16" viewBox="0 0 12 16"><path d="M6 0C2.7 0 0 2.7 0 6c0 4.5 6 10 6 10s6-5.5 6-10c0-3.3-2.7-6-6-6zm0 8.5c-1.4 0-2.5-1.1-2.5-2.5S4.6 3.5 6 3.5 8.5 4.6 8.5 6 7.4 8.5 6 8.5z" fill="#39d2c0" opacity="0.8"/></svg>',
    iconSize: [12, 16],
    iconAnchor: [6, 16]
  })

  const marker = L.marker([airport.lat, airport.lng], { icon, opacity: 0.7 }).addTo(map)
  marker.bindTooltip(airport.name ?? '', {
    className: 'aircraft-tooltip',
    direction: 'top',
    offset: [0, -12]
  })
  return marker
}

export function tryGeolocation (silent: boolean): void {
  const map = state.map
  if (!map) return

  if (!navigator.geolocation) {
    if (!silent) alert("La géolocalisation n'est pas supportée par votre navigateur.")
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      map.setView([position.coords.latitude, position.coords.longitude], INITIAL_ZOOM_LEVEL)
    },
    (error) => {
      if (silent) return
      switch (error.code) {
        case error.PERMISSION_DENIED:
          alert("Accès refusé : Vous avez bloqué la demande de géolocalisation. Veuillez l'autoriser dans les réglages de votre navigateur pour ce site.")
          break
        case error.POSITION_UNAVAILABLE:
          alert('Position non disponible : Votre navigateur ne parvient pas à déterminer votre emplacement actuel.')
          break
        case error.TIMEOUT:
          alert("Délai d'attente dépassé : La recherche de votre position a pris trop de temps.")
          break
        default:
          if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            alert("Erreur de sécurité : La géolocalisation ne fonctionne qu'en HTTPS ou sur localhost (vous êtes actuellement en HTTP).")
          } else {
            alert('Une erreur inconnue est survenue lors de la géolocalisation.')
          }
      }
    },
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
  )
}

class LocationControl extends L.Control {
  constructor () {
    super({ position: 'topleft' })
  }

  onAdd (): HTMLElement {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom')
    container.style.backgroundColor = 'var(--bg-glass)'
    container.style.width = '34px'
    container.style.height = '34px'
    container.style.display = 'flex'
    container.style.alignItems = 'center'
    container.style.justifyContent = 'center'
    container.style.cursor = 'pointer'
    container.style.backdropFilter = 'blur(12px)'
    container.innerHTML = '📍'
    container.title = 'Ma position'

    container.onclick = (e: MouseEvent) => {
      e.stopPropagation()
      tryGeolocation(false)
    }
    return container
  }
}

function injectMarkerStyles (): void {
  const style = document.createElement('style')
  style.textContent = [
    '.aircraft-div-icon { background: none !important; border: none !important; }',
    '.airport-icon { background: none !important; border: none !important; }',
    '.home-icon { background: none !important; border: none !important; }',
    '.home-marker { font-size: 22px; filter: drop-shadow(0 0 6px rgba(255,200,50,0.6)); transition: transform 0.2s; }',
    '.home-marker:hover { transform: scale(1.3); }',
    '.plane-marker { transition: color 0.3s ease; filter: drop-shadow(0 0 3px currentColor); }',
    '.plane-marker.selected { filter: drop-shadow(0 0 8px currentColor) drop-shadow(0 0 16px currentColor); }',
    '.plane-marker svg { display: block; }'
  ].join('\n')
  document.head.appendChild(style)
}
