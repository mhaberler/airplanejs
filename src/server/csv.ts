import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import type { ServerResponse } from 'node:http'

/**
 * Stream a CSV file to the response as a JSON array, normalizing each row.
 * `normalize` may return `null` to skip a row (e.g. inactive airlines).
 */
export function streamCSV<T> (
  res: ServerResponse,
  filePath: string,
  headers: string[],
  normalize: (row: Record<string, string | null>) => T | null
): void {
  res.setHeader('Content-Type', 'application/json')

  let first = true
  let finished = false

  const lines = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity })

  lines.on('line', (line: string) => {
    if (line.trim().length === 0) return

    const fields = parseCSVLine(line)
    if (fields.length === 0) return

    const row: Record<string, string | null> = {}
    for (let i = 0; i < headers.length; i++) {
      const value = fields[i] ?? ''
      row[headers[i]] = value === '\\N' ? null : value
    }

    const normalized = normalize(row)
    if (normalized === null) return

    res.write((first ? '[\n' : ',\n') + JSON.stringify(normalized) + '\n')
    first = false
  })

  lines.on('error', (err: Error) => {
    console.error(err.stack)
    if (first) res.writeHead(500)
    res.end()
    finished = true
  })

  lines.on('close', () => {
    if (finished) return
    res.end(first ? '[]' : ']')
  })
}

/**
 * Parse a single CSV line into fields, honoring quoted fields and `""` escape
 * sequences (RFC 4180, single-line records only — matches the OpenFlights data).
 */
export function parseCSVLine (line: string): string[] {
  const fields: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        fields.push(field)
        field = ''
      } else {
        field += char
      }
    }
  }

  fields.push(field)
  return fields
}
