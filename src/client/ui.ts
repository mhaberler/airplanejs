import { state } from './state'
import type { Aircraft } from './aircraft'

export type StatusState = 'connecting' | 'connected' | 'error'

export function setStatus (status: StatusState, text: string): void {
  const indicator = document.getElementById('status-indicator')
  const statusText = document.getElementById('status-text')
  if (indicator) indicator.className = 'status ' + status
  if (statusText) statusText.textContent = text
}

export function updateStats (): void {
  const countEl = document.getElementById('aircraft-count')
  const messagesEl = document.getElementById('messages-count')

  const count = state.aircraft.size
  if (countEl) countEl.textContent = String(count)

  let messages = 0
  for (const aircraft of state.aircraft.values()) {
    messages += aircraft.messages ?? 0
  }
  state.totalMessages = messages
  if (messagesEl) messagesEl.textContent = formatNumber(messages)
}

export function formatNumber (n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

export function showInfoPanel (aircraft: Aircraft): void {
  const panel = document.getElementById('info-panel')
  const content = document.getElementById('info-content')
  if (!panel || !content) return

  const unit = aircraft.unit === 0 ? 'ft' : 'm'
  const altitude = (aircraft.altitude !== null && aircraft.altitude !== undefined && aircraft.altitude !== 'ground')
    ? aircraft.altitude.toLocaleString() + ' ' + unit
    : (aircraft.altitude === 'ground' ? 'Ground' : '—')
  const speed = aircraft.speed !== null ? aircraft.speed + ' kts' : '—'
  const track = aircraft.heading !== null ? aircraft.heading + '°' : '—'
  const vertRate = aircraft.vertRate !== null && aircraft.vertRate !== undefined
    ? (aircraft.vertRate > 0 ? '↑ ' : aircraft.vertRate < 0 ? '↓ ' : '') + Math.abs(aircraft.vertRate) + ' ft/min'
    : '—'
  const squawk = aircraft.squawk ?? '—'
  const rssi = (aircraft.rssi !== null && aircraft.rssi !== undefined) ? aircraft.rssi.toFixed(1) + ' dBFS' : '—'

  const icaoPrefix = aircraft.callsign ? aircraft.callsign.slice(0, 3) : ''
  const airline = icaoPrefix ? state.airlines[icaoPrefix] : undefined
  const airlineName = airline?.name ?? '—'

  let emergencyHtml = ''
  if (aircraft.emergency && aircraft.emergency !== 'none') {
    emergencyHtml = `<span class="emergency-badge">⚠ ${aircraft.emergency.toUpperCase()}</span>`
  }
  if (squawk === '7500' || squawk === '7600' || squawk === '7700') {
    const sqText = squawk === '7500' ? 'HIJACK' : squawk === '7600' ? 'COMMS FAIL' : 'EMERGENCY'
    emergencyHtml = `<span class="emergency-badge">⚠ ${sqText} (${squawk})</span>`
  }

  content.innerHTML =
    '<div class="info-header">' +
      '<div class="plane-icon">✈️</div>' +
      '<div>' +
        `<div class="callsign-name">${aircraft.callsign ?? aircraft.icao}</div>` +
        `<div class="airline-name">${airlineName}</div>` +
      '</div>' +
    '</div>' +
    (emergencyHtml ? `<div style="margin-bottom:12px">${emergencyHtml}</div>` : '') +
    '<div class="info-grid">' +
      infoItem('ICAO', aircraft.icao) +
      infoItem('Squawk', squawk) +
      infoItem('Altitude', altitude) +
      infoItem('Vert Rate', vertRate) +
      infoItem('Speed', speed) +
      infoItem('Heading', track) +
      infoItem('RSSI', rssi) +
      infoItem('Messages', aircraft.messages !== undefined ? aircraft.messages.toLocaleString() : '—') +
    '</div>' +
    '<div class="info-links">' +
      (aircraft.callsign
        ? `<a href="https://www.flightradar24.com/${aircraft.callsign}" target="_blank" rel="noreferrer noopener">🔗 Flightradar24</a>`
        : '') +
      `<a href="https://globe.adsbexchange.com/?icao=${aircraft.icao.toLowerCase()}" target="_blank" rel="noreferrer noopener">🌍 ADS-B Exchange</a>` +
    '</div>'

  panel.classList.remove('hidden')
}

function infoItem (label: string, value: string): string {
  return `<div class="info-item"><div class="info-label">${label}</div><div class="info-value">${value}</div></div>`
}

export function hideInfoPanel (): void {
  document.getElementById('info-panel')?.classList.add('hidden')
}

export function updateTable (): void {
  const tbody = document.getElementById('aircraft-tbody')
  if (!tbody) return

  const sorted = Array.from(state.aircraft.values()).sort((a, b) => {
    if (a.icao === state.selectedIcao) return -1
    if (b.icao === state.selectedIcao) return 1
    const aName = a.callsign ?? a.icao
    const bName = b.callsign ?? b.icao
    return aName.localeCompare(bName)
  })

  let html = ''
  for (const aircraft of sorted) {
    const isSelected = aircraft.icao === state.selectedIcao
    const altitude = (aircraft.altitude !== null && aircraft.altitude !== undefined && aircraft.altitude !== 'ground')
      ? aircraft.altitude.toLocaleString()
      : (aircraft.altitude === 'ground' ? 'GND' : '—')
    const speed = aircraft.speed !== null ? String(aircraft.speed) : '—'
    const heading = aircraft.heading !== null ? aircraft.heading + '°' : '—'
    const squawk = aircraft.squawk ?? '—'
    const isEmergencySquawk = squawk === '7500' || squawk === '7600' || squawk === '7700'

    html +=
      `<tr class="${isSelected ? 'selected' : ''}" data-icao="${aircraft.icao}">` +
      `<td class="icao-cell">${aircraft.icao}</td>` +
      `<td class="callsign-cell">${aircraft.callsign ?? '—'}</td>` +
      `<td>${altitude}</td>` +
      `<td>${speed}</td>` +
      `<td>${heading}</td>` +
      `<td class="squawk-cell${isEmergencySquawk ? ' squawk-emergency' : ''}">${squawk}</td>` +
      '</tr>'
  }
  tbody.innerHTML = html

  const onSelect = state.onSelect
  tbody.querySelectorAll('tr').forEach((row) => {
    row.addEventListener('click', () => {
      const icao = row.getAttribute('data-icao')
      if (!icao || !onSelect) return
      onSelect(icao)
      const aircraft = state.aircraft.get(icao)
      if (aircraft && aircraft.lat !== undefined && aircraft.lng !== undefined && state.map) {
        state.map.panTo([aircraft.lat, aircraft.lng])
      }
    })
  })
}

export function toggleList (): void {
  document.getElementById('aircraft-list')?.classList.toggle('collapsed')
}
