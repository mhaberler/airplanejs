# AirplaneJS

📡 ✈️ An app written in JavaScript that reads ADS-B data from [dump1090-fa](https://github.com/flightaware/dump1090) and plots aircraft in real time on a map in your browser ✨🐢🚀✨

## Prerequisites

### dump1090-fa

This software requires a running instance of [dump1090-fa](https://github.com/flightaware/dump1090) (FlightAware's fork of dump1090). dump1090-fa handles the RTL-SDR hardware and decodes the ADS-B signals — AirplaneJS connects to its JSON API to display the data.

#### Installing dump1090-fa

**Raspberry Pi / Debian:**

```bash
sudo bash -c "$(wget -O - https://www.flightaware.com/adsb/piaware/install)"
# or
sudo apt-get install dump1090-fa
```

**macOS (Homebrew):**

```bash
brew install dump1090-mutability
# or build dump1090-fa from source
```

**From source:**

```bash
git clone https://github.com/flightaware/dump1090.git
cd dump1090
make
./dump1090 --net --interactive
```

Make sure dump1090-fa is running with network output enabled (`--net` flag). By default, it serves aircraft data at `http://localhost:8080/data/aircraft.json`.

### Hardware

You'll need an [RTL-SDR USB dongle with an RTL2832U chip](https://www.rtl-sdr.com/buy-rtl-sdr-dvb-t-dongles/) connected to the machine running dump1090-fa.

### Software

- [Node.js](https://nodejs.org) (v14 or later)
- [dump1090-fa](https://github.com/flightaware/dump1090) running and accessible

## Usage

### Quick start

1. Make sure dump1090-fa is running:
   ```bash
   dump1090-fa --net
   ```

2. Start AirplaneJS:
   ```bash
   npx airplanejs
   ```

Your default browser should automatically open to [http://localhost:3000](http://localhost:3000).

### Install globally

```bash
npm install airplanejs -g
airplanejs
```

### Options

| Option | Alias | Default | Description |
|---|---|---|---|
| `--help` | `-h` | | Show help |
| `--version` | `-v` | | Output version |
| `--dump1090-host` | `-H` | `localhost` | dump1090-fa host |
| `--dump1090-port` | `-P` | `8080` | dump1090-fa port |
| `--dump1090-path` | | `/data/aircraft.json` | JSON endpoint path |
| `--dump1090-https` | | `false` | Use HTTPS |
| `--dump1090-interval` | `-i` | `1000` | Poll interval (ms) |
| `--port` | `-p` | `3000` | HTTP server port |
| `--no-browser` | | | Don't open browser |

### Examples

```bash
# Connect to dump1090-fa on a Raspberry Pi
airplanejs --dump1090-host 192.168.1.100

# Connect to dump1090-fa on a custom port
airplanejs --dump1090-host piaware.local --dump1090-port 8888

# Run on port 8000 without opening browser
airplanejs --port 8000 --no-browser
```

## Features

- 🗺️ **Live map** with dark theme (OpenStreetMap / CartoDB)
- ✈️ **Aircraft markers** colored by altitude
- 📊 **Aircraft list** with real-time updates
- 📡 **Detailed info panel** showing altitude, speed, heading, squawk, RSSI, vertical rate
- 🔗 **Direct links** to Flightradar24 and ADS-B Exchange
- 🚨 **Emergency squawk detection** (7500, 7600, 7700)
- 🌐 **No API keys required** — uses free OpenStreetMap tiles

## Architecture

```
RTL-SDR USB → dump1090-fa (decoding) → HTTP JSON API → AirplaneJS (visualization)
```

AirplaneJS polls dump1090-fa's `aircraft.json` endpoint and serves a web interface with a live map.

## Migrating from v1

Version 2.0 replaces the direct RTL-SDR access (via `rtl-sdr` and `mode-s-demodulator` npm packages) with dump1090-fa integration. This means:

- ✅ No more native compilation issues
- ✅ No Python 2 dependency
- ✅ Works with modern Node.js
- ✅ Better decoding (dump1090-fa is the gold standard)
- ✅ Free map tiles (no Google Maps API key needed)

## License

MIT
