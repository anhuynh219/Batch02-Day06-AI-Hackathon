import { describe, it, expect } from 'vitest'
import { buildItinerary } from './scheduleEngine'
import type { Attraction, PlanEntry, UserConstraints } from '../types'

const mkAttr = (p: Partial<Attraction> & Pick<Attraction,'id'|'zoneId'>): Attraction => ({
  name: p.id, kind: 'ride' as any, durationMin: 30, intensity: 3, kidFriendly: true,
  tags: [], openTime: '09:00', closeTime: '19:30', ...p,
}) as Attraction

const attrs: Record<string, Attraction> = {
  r1: mkAttr({ id: 'r1', zoneId: 'A', durationMin: 30 }),
  r2: mkAttr({ id: 'r2', zoneId: 'B', durationMin: 20 }),
  late: mkAttr({ id: 'late', zoneId: 'A', durationMin: 30, openTime: '09:00', closeTime: '19:30' }),
  show: mkAttr({ id: 'show', zoneId: 'A', kind: 'show', durationMin: 35, showTimes: ['18:30'] }),
}

const baseConstraints: UserConstraints = {
  arrivalTime: '09:00', departureTime: '19:30', groupSize: 2, hasKids: false,
  prefs: [], meals: [], mustDo: [], avoid: [],
}

// travel takes PLACE keys (attraction id or zone id). Resolve an attraction id to its
// zone, then charge 10 min between different zones, 0 within the same zone.
const zoneOf = (k: string | null) => (k ? (attrs[k]?.zoneId ?? k) : null)
const travel = (a: string | null, b: string | null) => {
  const za = zoneOf(a), zb = zoneOf(b)
  return za && zb && za !== zb ? 10 : 0
}

describe('buildItinerary', () => {
  it('sequences two rides, no leading buffer, buffer between different zones', () => {
    const entries: PlanEntry[] = [
      { kind: 'attraction', refId: 'r1' },
      { kind: 'attraction', refId: 'r2' },
    ]
    const items = buildItinerary({ entries, constraints: baseConstraints, attractions: attrs, travel })
    expect(items[0].startTime).toBe('09:00')
    expect(items[0].endTime).toBe('09:30')
    expect(items[1].startTime).toBe('09:40') // 09:30 + 10 buffer
    expect(items[1].endTime).toBe('10:00')
    expect(items[0].warning).toBeUndefined()
  })

  it('pins a show to its showtime', () => {
    const entries: PlanEntry[] = [{ kind: 'attraction', refId: 'show' }]
    const items = buildItinerary({ entries, constraints: baseConstraints, attractions: attrs, travel })
    expect(items[0].type).toBe('show')
    expect(items[0].startTime).toBe('18:30')
    expect(items[0].endTime).toBe('19:05')
  })

  it('warns when an item ends after closing time', () => {
    const c = { ...baseConstraints, arrivalTime: '19:10' }
    const entries: PlanEntry[] = [{ kind: 'attraction', refId: 'late' }] // 19:10-19:40 > 19:30
    const items = buildItinerary({ entries, constraints: c, attractions: attrs, travel })
    expect(items[0].warning).toMatch(/đóng cửa/i)
  })

  it('warns when itinerary exceeds departure time', () => {
    const c = { ...baseConstraints, departureTime: '09:20' }
    const entries: PlanEntry[] = [{ kind: 'attraction', refId: 'r1' }] // ends 09:30 > 09:20
    const items = buildItinerary({ entries, constraints: c, attractions: attrs, travel })
    expect(items[0].warning).toMatch(/giờ về/i)
  })

  it('warns when you cannot reach a show in time', () => {
    const c = { ...baseConstraints, arrivalTime: '18:00' }
    const entries: PlanEntry[] = [
      { kind: 'attraction', refId: 'r2' },
      { kind: 'attraction', refId: 'show' },
    ]
    const items = buildItinerary({ entries, constraints: c, attractions: attrs, travel })
    expect(items[1].startTime).toBe('18:30')
    const c2 = { ...baseConstraints, arrivalTime: '18:15' }
    const items2 = buildItinerary({ entries, constraints: c2, attractions: attrs, travel })
    expect(items2[1].warning).toMatch(/không kịp/i)
  })

  it('inserts meal entries with their duration', () => {
    const entries: PlanEntry[] = [
      { kind: 'attraction', refId: 'r1' },
      { kind: 'meal', meal: { type: 'lunch', around: '12:00' }, durationMin: 45, zoneId: 'A' },
    ]
    const items = buildItinerary({ entries, constraints: baseConstraints, attractions: attrs, travel })
    expect(items[1].type).toBe('meal')
    expect(items[1].startTime).toBe('09:30')
    expect(items[1].endTime).toBe('10:15')
  })

  it('prepends a locked entrance stop and buffers the first ride from it', () => {
    const entries: PlanEntry[] = [{ kind: 'attraction', refId: 'r1' }] // zone A
    const items = buildItinerary({
      entries, constraints: baseConstraints, attractions: attrs, travel,
      entrance: { name: 'Quầy vé', zoneId: 'GATE', durationMin: 10 },
    })
    expect(items[0].type).toBe('entrance')
    expect(items[0].locked).toBe(true)
    expect(items[0].startTime).toBe('09:00')
    expect(items[0].endTime).toBe('09:10')
    // first ride: 09:10 + travel(GATE->A = 10) = 09:20, +30 dur = 09:50
    expect(items[1].startTime).toBe('09:20')
    expect(items[1].endTime).toBe('09:50')
  })

  it('does not prepend entrance when there are no entries', () => {
    const items = buildItinerary({
      entries: [], constraints: baseConstraints, attractions: attrs, travel,
      entrance: { name: 'Quầy vé', zoneId: 'GATE', durationMin: 10 },
    })
    expect(items).toEqual([])
  })

  it('closes the loop with a return-to-entrance stop', () => {
    const entries: PlanEntry[] = [{ kind: 'attraction', refId: 'r1' }] // zone A
    const items = buildItinerary({
      entries, constraints: baseConstraints, attractions: attrs, travel,
      entrance: { name: 'Quầy vé', zoneId: 'GATE', durationMin: 10 },
    })
    const last = items[items.length - 1]
    expect(last.type).toBe('return')
    expect(last.zoneId).toBe('GATE')
    // ride ends 09:50, travel A->GATE = 10 -> return at 10:00
    expect(last.startTime).toBe('10:00')
  })
})
