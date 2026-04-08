'use strict'

// ============================
// AirplaneJS Client — Leaflet
// ============================

const aircraftIndex = {}
const airlineICAOIndex = {}
const airportSize = {}
const airportMarkers = []
const INITIAL_ZOOM_LEVEL = 9
const POLL_INTERVAL = 2000
const PRUNE_TIMEOUT = 120000

let map, selectedIcao, totalMessages = 0

// ——— Status ———
const statusIndicator = document.getElementById('status-indicator')
const statusText = document.getElementById('status-text')
const aircraftCountEl = document.getElementById('aircraft-count')
const messagesCountEl = document.getElementById('messages-count')

function setStatus (state, text) {
  statusIndicator.className = 'status ' + state
  statusText.textContent = text
}

// ——— Init Map ———
function initMap () {
  // Try geolocation, fallback to 50.468223, 3.081006
  const defaultCenter = [50.468223, 3.081006]

  map = L.map('map', {
    center: defaultCenter,
    zoom: INITIAL_ZOOM_LEVEL,
    zoomControl: true,
    attributionControl: true
  })

  // Dark tile layer — CartoDB Dark Matter
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a> | dump1090-fa',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map)

  // Add Location Button
  const LocationControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function() {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
      container.style.backgroundColor = 'var(--bg-glass)';
      container.style.width = '34px';
      container.style.height = '34px';
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'center';
      container.style.cursor = 'pointer';
      container.style.backdropFilter = 'blur(12px)';
      container.innerHTML = '📍';
      container.title = 'Ma position';
      
      container.onclick = function(e) {
        e.stopPropagation();
        tryGeolocation();
      };
      return container;
    }
  });
  map.addControl(new LocationControl());

  // Try geolocation on load
  tryGeolocation(true);

  // Home marker
  const homeIcon = L.divIcon({
    className: 'home-icon',
    html: '<div class="home-marker">🏠</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  })
  L.marker(defaultCenter, { icon: homeIcon, zIndexOffset: 500, interactive: false }).addTo(map)
    .bindTooltip('Station de réception', {
      className: 'aircraft-tooltip',
      direction: 'top',
      offset: [0, -10],
      permanent: false
    })

  // Load data
  fetchJSON('routes', parseRoutes, function () {
    fetchJSON('airports', plotAirports)
  })
  fetchJSON('airlines', parseAirlines)

  // Start aircraft polling
  pollAircrafts()
  setInterval(pollAircrafts, POLL_INTERVAL)
}

// ——— Simple fetch wrapper ———
function fetchJSON (url, onSuccess, onDone) {
  const xhr = new XMLHttpRequest()
  xhr.open('GET', url, true)
  xhr.responseType = 'json'
  xhr.onload = function () {
    if (xhr.status === 200 && xhr.response) {
      onSuccess(xhr.response)
    }
    if (onDone) onDone()
  }
  xhr.onerror = function () {
    console.warn('Failed to load:', url)
    if (onDone) onDone()
  }
  xhr.send()
}

// ——— Airlines ———
function parseAirlines (airlines) {
  airlines.forEach(function (airline) {
    if (airline.ICAO) airlineICAOIndex[airline.ICAO] = airline
  })
}

// ——— Routes (for airport sizing) ———
function parseRoutes (routes) {
  routes.forEach(function (route) {
    tickAirport(route.source)
    tickAirport(route.dest)
  })
}

function tickAirport (IATA) {
  if (!IATA) return
  if (!airportSize[IATA]) airportSize[IATA] = 1
  else airportSize[IATA]++
}

// ——— Airports ———
function plotAirports (airports) {
  const VISIBILITY_THRESHOLDS = [
    null, 200, 150, 120, 100, 80, 60, 40, 20,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
  ]

  const visThreshold = VISIBILITY_THRESHOLDS[INITIAL_ZOOM_LEVEL]

  airports.forEach(function (airport) {
    if (!airport.lat || !airport.lng) return

    const size = airportSize[airport.IATA] || 0
    const visible = visThreshold ? size > visThreshold : true

    const icon = L.divIcon({
      className: 'airport-icon',
      html: '<svg width="12" height="16" viewBox="0 0 12 16"><path d="M6 0C2.7 0 0 2.7 0 6c0 4.5 6 10 6 10s6-5.5 6-10c0-3.3-2.7-6-6-6zm0 8.5c-1.4 0-2.5-1.1-2.5-2.5S4.6 3.5 6 3.5 8.5 4.6 8.5 6 7.4 8.5 6 8.5z" fill="#39d2c0" opacity="0.8"/></svg>',
      iconSize: [12, 16],
      iconAnchor: [6, 16]
    })

    const marker = L.marker([airport.lat, airport.lng], {
      icon: icon,
      opacity: visible ? 0.7 : 0
    }).addTo(map)

    marker.bindTooltip(airport.name, {
      className: 'aircraft-tooltip',
      direction: 'top',
      offset: [0, -12]
    })

    marker._airportData = airport
    marker._airportSize = size
    airportMarkers.push(marker)
  })

  // Update visibility on zoom
  map.on('zoomend', function () {
    const level = map.getZoom()
    const threshold = VISIBILITY_THRESHOLDS[level]
    airportMarkers.forEach(function (m) {
      const s = m._airportSize || 0
      const v = threshold ? s > threshold : true
      m.setOpacity(v ? 0.7 : 0)
    })
  })
}

// ——— Aircraft Polling ———
function pollAircrafts () {
  fetchJSON('aircrafts', function (aircrafts) {
    if (aircrafts.length > 0) {
      setStatus('connected', 'Live — ' + aircrafts.length + ' aircraft')
    } else {
      setStatus('connected', 'Connected — no aircraft')
    }

    plotAircrafts(aircrafts)
    updateStats()
  })
}

function plotAircrafts (aircrafts) {
  aircrafts.forEach(function (data) {
    let ac = aircraftIndex[data.icao]
    if (!ac) {
      ac = new Aircraft(data.icao)
      aircraftIndex[data.icao] = ac
    }
    ac.update(data)
  })
  pruneMarkers()
  updateTable()
}

function pruneMarkers () {
  const threshold = Date.now() - PRUNE_TIMEOUT
  Object.keys(aircraftIndex).forEach(function (icao) {
    const ac = aircraftIndex[icao]
    if (ac.seen < threshold) {
      if (ac.marker) {
        map.removeLayer(ac.marker)
      }
      if (ac.trail) {
        map.removeLayer(ac.trail)
      }
      if (selectedIcao === icao) {
        selectedIcao = null
        hideInfoPanel()
      }
      delete aircraftIndex[icao]
    }
  })
}

function updateStats () {
  const count = Object.keys(aircraftIndex).length
  aircraftCountEl.textContent = count

  let msgs = 0
  Object.keys(aircraftIndex).forEach(function (icao) {
    msgs += aircraftIndex[icao].messages || 0
  })
  totalMessages = msgs
  messagesCountEl.textContent = formatNumber(msgs)
}

function formatNumber (n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

// ——— Aircraft Class ———
function Aircraft (icao) {
  this.icao = icao
  this.trailCoords = []
  this.marker = null
  this.trail = null
  this.seen = Date.now()
}

Aircraft.prototype.update = function (data) {
  this.callsign = data.callsign || this.callsign
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
  this.messages = data.messages || this.messages || 0
  this.emergency = data.emergency
  this.seen = data.seen || Date.now()
  this.count = data.count || (this.count || 0) + 1

  const pos = [this.lat, this.lng]
  this.trailCoords.push(pos)
  // Keep trail limited
  if (this.trailCoords.length > 500) {
    this.trailCoords = this.trailCoords.slice(-300)
  }

  const isSelected = selectedIcao === this.icao
  const rotation = this.heading || 0
  const altColor = this.getAltitudeColor()

  const iconHtml = '<div class="plane-marker' + (isSelected ? ' selected' : '') + '" style="transform:rotate(' + rotation + 'deg);color:' + altColor + '">' +
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
    this.marker = L.marker(pos, { icon: icon, zIndexOffset: 1000 }).addTo(map)
    const self = this
    this.marker.on('click', function () {
      selectAircraft(self.icao)
    })
  }

  // Update tooltip
  const tooltipText = this.callsign || this.icao
  this.marker.unbindTooltip()
  this.marker.bindTooltip(tooltipText, {
    className: 'aircraft-tooltip',
    direction: 'top',
    offset: [0, -14],
    permanent: false
  })

  // Trail
  if (isSelected) {
    if (this.trail) {
      this.trail.setLatLngs(this.trailCoords)
    } else {
      this.trail = L.polyline(this.trailCoords, {
        color: altColor,
        weight: 2,
        opacity: 0.7,
        dashArray: '4 6'
      }).addTo(map)
    }
    showInfoPanel(this)
  } else {
    if (this.trail) {
      map.removeLayer(this.trail)
      this.trail = null
    }
  }
}

Aircraft.prototype.getAltitudeColor = function () {
  if (this.altitude === null || this.altitude === undefined || this.altitude === 'ground') {
    return '#8b949e'
  }
  const alt = typeof this.altitude === 'number' ? this.altitude : 0
  // Color scale: ground (gray) → low (green) → mid (yellow) → high (orange) → very high (red/purple)
  if (alt < 1000) return '#3fb950'
  if (alt < 5000) return '#58a6ff'
  if (alt < 15000) return '#d29922'
  if (alt < 30000) return '#f0883e'
  if (alt < 40000) return '#f85149'
  return '#bc8cff'
}

// ——— Selection & Info Panel ———
function selectAircraft (icao) {
  const prev = selectedIcao
  selectedIcao = icao

  // Update previous aircraft marker (remove selected state)
  if (prev && aircraftIndex[prev]) {
    const prevAc = aircraftIndex[prev]
    if (prevAc.trail) {
      map.removeLayer(prevAc.trail)
      prevAc.trail = null
    }
    // Re-render marker
    prevAc.update(prevAc)
  }

  // Update new selection
  if (aircraftIndex[icao]) {
    aircraftIndex[icao].update(aircraftIndex[icao])
  }

  updateTable()
}

function showInfoPanel (aircraft) {
  const panel = document.getElementById('info-panel')
  const content = document.getElementById('info-content')

  const unit = aircraft.unit === 0 ? 'ft' : 'm'
  const altitude = (aircraft.altitude !== null && aircraft.altitude !== undefined && aircraft.altitude !== 'ground')
    ? aircraft.altitude.toLocaleString() + ' ' + unit
    : (aircraft.altitude === 'ground' ? 'Ground' : '—')
  const speed = aircraft.speed !== null ? aircraft.speed + ' kts' : '—'
  const track = aircraft.heading !== null ? aircraft.heading + '°' : '—'
  const vertRate = aircraft.vertRate !== null
    ? (aircraft.vertRate > 0 ? '↑ ' : aircraft.vertRate < 0 ? '↓ ' : '') + Math.abs(aircraft.vertRate) + ' ft/min'
    : '—'
  const squawk = aircraft.squawk || '—'
  const rssi = aircraft.rssi !== null ? aircraft.rssi.toFixed(1) + ' dBFS' : '—'

  const ICAO = aircraft.callsign && aircraft.callsign.slice(0, 3)
  const airline = ICAO && airlineICAOIndex[ICAO]
  const airlineName = airline ? airline.name : '—'

  let emergencyHtml = ''
  if (aircraft.emergency && aircraft.emergency !== 'none') {
    emergencyHtml = '<span class="emergency-badge">⚠ ' + aircraft.emergency.toUpperCase() + '</span>'
  }
  if (aircraft.squawk === '7500' || aircraft.squawk === '7600' || aircraft.squawk === '7700') {
    const sqText = aircraft.squawk === '7500' ? 'HIJACK' : aircraft.squawk === '7600' ? 'COMMS FAIL' : 'EMERGENCY'
    emergencyHtml = '<span class="emergency-badge">⚠ ' + sqText + ' (' + aircraft.squawk + ')</span>'
  }

  content.innerHTML =
    '<div class="info-header">' +
      '<div class="plane-icon">✈️</div>' +
      '<div>' +
        '<div class="callsign-name">' + (aircraft.callsign || aircraft.icao) + '</div>' +
        '<div class="airline-name">' + airlineName + '</div>' +
      '</div>' +
    '</div>' +
    (emergencyHtml ? '<div style="margin-bottom:12px">' + emergencyHtml + '</div>' : '') +
    '<div class="info-grid">' +
      infoItem('ICAO', aircraft.icao) +
      infoItem('Squawk', squawk) +
      infoItem('Altitude', altitude) +
      infoItem('Vert Rate', vertRate) +
      infoItem('Speed', speed) +
      infoItem('Heading', track) +
      infoItem('RSSI', rssi) +
      infoItem('Messages', aircraft.messages ? aircraft.messages.toLocaleString() : '—') +
    '</div>' +
    '<div class="info-links">' +
      (aircraft.callsign
        ? '<a href="https://www.flightradar24.com/' + aircraft.callsign + '" target="_blank" rel="noreferrer noopener">🔗 Flightradar24</a>'
        : '') +
      '<a href="https://globe.adsbexchange.com/?icao=' + aircraft.icao.toLowerCase() + '" target="_blank" rel="noreferrer noopener">🌍 ADS-B Exchange</a>' +
    '</div>'

  panel.classList.remove('hidden')
}

function infoItem (label, value) {
  return '<div class="info-item"><div class="info-label">' + label + '</div><div class="info-value">' + value + '</div></div>'
}

function hideInfoPanel () {
  document.getElementById('info-panel').classList.add('hidden')
}

// ——— Aircraft Table ———
function updateTable () {
  const tbody = document.getElementById('aircraft-tbody')
  const sortedAircrafts = Object.keys(aircraftIndex)
    .map(function (icao) { return aircraftIndex[icao] })
    .sort(function (a, b) {
      // Selected first, then by callsign/icao
      if (a.icao === selectedIcao) return -1
      if (b.icao === selectedIcao) return 1
      const aName = a.callsign || a.icao
      const bName = b.callsign || b.icao
      return aName.localeCompare(bName)
    })

  let html = ''
  sortedAircrafts.forEach(function (ac) {
    const isSelected = ac.icao === selectedIcao
    const alt = (ac.altitude !== null && ac.altitude !== undefined && ac.altitude !== 'ground')
      ? ac.altitude.toLocaleString()
      : (ac.altitude === 'ground' ? 'GND' : '—')
    const spd = ac.speed !== null ? ac.speed : '—'
    const hdg = ac.heading !== null ? ac.heading + '°' : '—'
    const sqk = ac.squawk || '—'
    const isEmergencySquawk = sqk === '7500' || sqk === '7600' || sqk === '7700'

    html += '<tr class="' + (isSelected ? 'selected' : '') + '" data-icao="' + ac.icao + '">' +
      '<td class="icao-cell">' + ac.icao + '</td>' +
      '<td class="callsign-cell">' + (ac.callsign || '—') + '</td>' +
      '<td>' + alt + '</td>' +
      '<td>' + spd + '</td>' +
      '<td>' + hdg + '</td>' +
      '<td class="squawk-cell' + (isEmergencySquawk ? ' squawk-emergency' : '') + '">' + sqk + '</td>' +
      '</tr>'
  })

  tbody.innerHTML = html

  // Add click handlers
  const rows = tbody.querySelectorAll('tr')
  rows.forEach(function (row) {
    row.addEventListener('click', function () {
      const icao = this.getAttribute('data-icao')
      selectAircraft(icao)
      // Pan to aircraft
      const ac = aircraftIndex[icao]
      if (ac && ac.lat && ac.lng) {
        map.panTo([ac.lat, ac.lng])
      }
    })
  })
}

// ——— Panel Toggle ———
document.getElementById('info-close').addEventListener('click', function () {
  selectedIcao = null
  hideInfoPanel()
  // Remove all trails
  Object.keys(aircraftIndex).forEach(function (icao) {
    const ac = aircraftIndex[icao]
    if (ac.trail) {
      map.removeLayer(ac.trail)
      ac.trail = null
    }
    if (ac.marker) ac.update(ac)
  })
  updateTable()
})

document.getElementById('list-toggle').addEventListener('click', toggleList)
document.querySelector('.panel-header').addEventListener('click', toggleList)

function toggleList () {
  document.getElementById('aircraft-list').classList.toggle('collapsed')
}

// ——— Custom marker CSS (injected) ———
const markerStyle = document.createElement('style')
markerStyle.textContent = [
  '.aircraft-div-icon { background: none !important; border: none !important; }',
  '.airport-icon { background: none !important; border: none !important; }',
  '.home-icon { background: none !important; border: none !important; }',
  '.home-marker { font-size: 22px; filter: drop-shadow(0 0 6px rgba(255,200,50,0.6)); transition: transform 0.2s; }',
  '.home-marker:hover { transform: scale(1.3); }',
  '.plane-marker { transition: color 0.3s ease; filter: drop-shadow(0 0 3px currentColor); }',
  '.plane-marker.selected { filter: drop-shadow(0 0 8px currentColor) drop-shadow(0 0 16px currentColor); }',
  '.plane-marker svg { display: block; }'
].join('\n')
document.head.appendChild(markerStyle)

// ——— Geolocation ———
function tryGeolocation(silent = false) {
  if (!navigator.geolocation) {
    if (!silent) alert("La géolocalisation n'est pas supportée par votre navigateur.");
    return;
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0
  };

  navigator.geolocation.getCurrentPosition(
    function(position) {
      console.log('Position trouvée:', position.coords.latitude, position.coords.longitude);
      map.setView([position.coords.latitude, position.coords.longitude], INITIAL_ZOOM_LEVEL);
    },
    function(error) {
      console.warn('Erreur géoloc (' + error.code + '): ' + error.message);
      if (!silent) {
        switch(error.code) {
          case 1: // PERMISSION_DENIED
            alert("Accès refusé : Vous avez bloqué la demande de géolocalisation. Veuillez l'autoriser dans les réglages de votre navigateur pour ce site.");
            break;
          case 2: // POSITION_UNAVAILABLE
            alert("Position non disponible : Votre navigateur ne parvient pas à déterminer votre emplacement actuel.");
            break;
          case 3: // TIMEOUT
            alert("Délai d'attente dépassé : La recherche de votre position a pris trop de temps.");
            break;
          default:
            if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
              alert("Erreur de sécurité : La géolocalisation ne fonctionne qu'en HTTPS ou sur localhost (vous êtes actuellement en HTTP).");
            } else {
              alert("Une erreur inconnue est survenue lors de la géolocalisation.");
            }
        }
      }
    },
    options
  );
}

// ——— Start ———
initMap()
