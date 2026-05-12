export function parseSimpleCsv(input: string, delimiter = ",", maxRows = 50) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const next = input[index + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === delimiter) {
      row.push(cell)
      cell = ""
      continue
    }
    if (char === "\n") {
      row.push(cell)
      rows.push(row)
      if (rows.length >= maxRows) return rows
      row = []
      cell = ""
      continue
    }
    if (char !== "\r") cell += char
  }
  row.push(cell)
  if (row.length > 1 || row[0]) rows.push(row)
  return rows
}

export function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"' && !inQuotes) {
      inQuotes = true
      continue
    }
    if (ch === '"' && inQuotes) {
      if (line[i + 1] === '"') {
        cur += '"'
        i++
      } else inQuotes = false
      continue
    }
    if (ch === "," && !inQuotes) {
      result.push(cur)
      cur = ""
      continue
    }
    cur += ch
  }
  result.push(cur)
  return result
}
