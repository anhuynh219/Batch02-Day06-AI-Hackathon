export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function toHHMM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function addMinutes(hhmm: string, delta: number): string {
  return toHHMM(toMinutes(hhmm) + delta)
}

// Coerce loose human / LLM time strings into strict 24h "HH:MM", or undefined if
// unparseable. Handles "9", "9h", "9h30", "9:00", "9.30", "9 giờ 30", and am/pm
// hints ("sáng" / "chiều" / "tối" / "đêm" / "am" / "pm"). Guards the engine from
// the NaN cascade that a value like "9h" would cause in toMinutes().
export function normalizeTime(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const s = raw.trim().toLowerCase()
  if (!s) return undefined
  // Order matters: "giờ" must precede the single-char "g" so the longer token wins.
  const m = s.match(/(\d{1,2})\s*(?::|\.|giờ|h|g)?\s*(\d{1,2})?/)
  if (!m) return undefined
  let h = parseInt(m[1], 10)
  const min = m[2] != null ? parseInt(m[2], 10) : 0
  if (Number.isNaN(h) || Number.isNaN(min)) return undefined
  const pm = /(chiều|tối|đêm|pm)/.test(s)
  const am = /(sáng|am)/.test(s)
  if (pm && h < 12) h += 12
  if (am && h === 12) h = 0
  if (h > 23 || min > 59) return undefined
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}
