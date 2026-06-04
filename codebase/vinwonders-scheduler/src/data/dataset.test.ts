import { describe, it, expect } from 'vitest'
import { ATTRACTIONS } from './attractions'
import { ZONES_BY_ID } from './zones'

describe('dataset integrity', () => {
  it('every attraction references an existing zone', () => {
    for (const a of ATTRACTIONS) {
      expect(ZONES_BY_ID[a.zoneId], `${a.id} -> ${a.zoneId}`).toBeTruthy()
    }
  })
  it('attraction ids are unique', () => {
    const ids = ATTRACTIONS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('shows have showTimes, non-shows do not', () => {
    for (const a of ATTRACTIONS) {
      if (a.kind === 'show') expect(a.showTimes?.length).toBeGreaterThan(0)
      else expect(a.showTimes).toBeUndefined()
    }
  })
})
