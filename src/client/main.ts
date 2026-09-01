import 'leaflet/dist/leaflet.css'
import './style.css'
import type { Airline, Airport, Route, AircraftDTO } from '../shared/types'
import { POLL_INTERVAL, PRUNE_TIMEOUT, state } from './state'
import { fetchJSON } from './data'
import { initMap, plotAirports } from './map'
import { Aircraft } from './aircraft'
import { hideInfoPanel, setStatus, showInfoPanel, toggleList, updateStats, updateTable } from './ui'

function tickAirport (iata: string | null): void {
  if (!iata) return
  state.airportSize[iata] = (state.airportSize[iata] ?? 0) + 1
}

async function loadData (): Promise<void> {
  const airlines = await fetchJSON<Airline[]>('/airlines')
  for (const airline of airlines) {
    if (airline.ICAO) state.airlines[airline.ICAO] = airline
  }

  const routes = await fetchJSON<Route[]>('/routes')
  for (const route of routes) {
    tickAirport(route.source)
    tickAirport(route.dest)
  }

  const airports = await fetchJSON<Airport[]>('/airports')
  plotAirports(airports)
}

async function pollAircrafts (): Promise<void> {
  try {
    const list = await fetchJSON<AircraftDTO[]>('/aircrafts')
    setStatus('connected', list.length > 0 ? `Live — ${list.length} aircraft` : 'Connected — no aircraft')
    plotAircrafts(list)
    updateStats()
  } catch (err) {
    setStatus('error', 'Disconnected')
    console.error(err)
  }
}

function plotAircrafts (list: AircraftDTO[]): void {
  const map = state.map
  if (!map) return

  for (const data of list) {
    let aircraft = state.aircraft.get(data.icao)
    if (!aircraft) {
      aircraft = new Aircraft(data.icao)
      state.aircraft.set(data.icao, aircraft)
    }
    aircraft.apply(data)
    aircraft.render({
      map,
      isSelected: state.selectedIcao === data.icao,
      onSelect: selectAircraft,
      onInfo: showInfoPanel
    })
  }

  pruneMarkers()
  updateTable()
}

function pruneMarkers (): void {
  const map = state.map
  if (!map) return

  const threshold = Date.now() - PRUNE_TIMEOUT
  for (const [icao, aircraft] of state.aircraft) {
    if (aircraft.seen < threshold) {
      if (aircraft.marker) map.removeLayer(aircraft.marker)
      if (aircraft.trail) map.removeLayer(aircraft.trail)
      if (state.selectedIcao === icao) {
        state.selectedIcao = null
        hideInfoPanel()
      }
      state.aircraft.delete(icao)
    }
  }
}

function selectAircraft (icao: string): void {
  const map = state.map
  if (!map) return

  const previous = state.selectedIcao
  state.selectedIcao = icao

  const render = (aircraft: Aircraft, isSelected: boolean): void => {
    aircraft.render({ map, isSelected, onSelect: selectAircraft, onInfo: showInfoPanel })
  }

  // Deselect and re-render the previous aircraft.
  if (previous && state.aircraft.has(previous)) {
    const prevAircraft = state.aircraft.get(previous)!
    if (prevAircraft.trail) {
      map.removeLayer(prevAircraft.trail)
      prevAircraft.trail = null
    }
    render(prevAircraft, false)
  }

  const current = state.aircraft.get(icao)
  if (current) render(current, true)

  updateTable()
}

function bindEvents (): void {
  document.getElementById('info-close')?.addEventListener('click', () => {
    state.selectedIcao = null
    hideInfoPanel()

    const map = state.map
    if (map) {
      for (const aircraft of state.aircraft.values()) {
        if (aircraft.trail) {
          map.removeLayer(aircraft.trail)
          aircraft.trail = null
        }
        aircraft.render({ map, isSelected: false, onSelect: selectAircraft, onInfo: showInfoPanel })
      }
    }
    updateTable()
  })

  document.querySelector('.panel-header')?.addEventListener('click', toggleList)
}

function init (): void {
  initMap()
  state.onSelect = selectAircraft
  bindEvents()

  loadData().catch((err) => console.error(err))
  pollAircrafts()
  setInterval(pollAircrafts, POLL_INTERVAL)
}

init()
