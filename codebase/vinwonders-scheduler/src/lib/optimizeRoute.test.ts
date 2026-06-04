import { describe, it, expect } from 'vitest'
import { tspOrder, optimizeEntries } from './optimizeRoute'
import type { Attraction, PlanEntry } from '../types'

function tourCost(order: number[], M: number[][]): number {
  let c = M[0][order[0]]
  for (let i = 0; i < order.length - 1; i++) c += M[order[i]][order[i + 1]]
  c += M[order[order.length - 1]][0]
  return c
}
function bruteMin(n: number, M: number[][]): number {
  const nodes = Array.from({ length: n }, (_, i) => i + 1)
  let best = Infinity
  const perm = (arr: number[], cur: number[]) => {
    if (!arr.length) { best = Math.min(best, tourCost(cur, M)); return }
    for (let i = 0; i < arr.length; i++) perm([...arr.slice(0, i), ...arr.slice(i + 1)], [...cur, arr[i]])
  }
  perm(nodes, [])
  return best
}

describe('tspOrder (Held-Karp closed tour)', () => {
  // 2D points; M[i][j] = Euclidean. Node 0 = start.
  const pts = [[0, 0], [2, 0], [2, 2], [0, 2], [1, 3]]
  const M = pts.map((a) => pts.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1])))
  it('returns a permutation of 1..n', () => {
    const order = tspOrder(4, M)
    expect([...order].sort()).toEqual([1, 2, 3, 4])
  })
  it('achieves the brute-force optimal tour cost', () => {
    const order = tspOrder(4, M)
    expect(tourCost(order, M)).toBeCloseTo(bruteMin(4, M), 6)
  })
})

describe('optimizeEntries', () => {
  const attractions: Record<string, Attraction> = {
    a1: { id: 'a1', name: 'a1', zoneId: 'A', kind: 'family', durationMin: 20, intensity: 3, kidFriendly: true, tags: [], openTime: '09:00', closeTime: '19:30' },
    a2: { id: 'a2', name: 'a2', zoneId: 'B', kind: 'family', durationMin: 20, intensity: 3, kidFriendly: true, tags: [], openTime: '09:00', closeTime: '19:30' },
    a3: { id: 'a3', name: 'a3', zoneId: 'A', kind: 'family', durationMin: 20, intensity: 3, kidFriendly: true, tags: [], openTime: '09:00', closeTime: '19:30' },
    show1: { id: 'show1', name: 'show1', zoneId: 'C', kind: 'show', durationMin: 30, intensity: 2, kidFriendly: true, tags: [], openTime: '09:00', closeTime: '19:30', showTimes: ['18:30'] },
  }
  // 1-D positions per zone; E=entrance. dist works on PLACE keys (attraction id or
  // zone id), so resolve an attraction id to its zone position, else treat key as a zone.
  const pos: Record<string, number> = { E: 0, A: 1, B: 9, C: 5 }
  const posOf = (k: string) => pos[attractions[k]?.zoneId ?? k]
  const dist = (a: string, b: string) => Math.abs(posOf(a) - posOf(b))

  const entries: PlanEntry[] = [
    { kind: 'attraction', refId: 'a2' }, // B
    { kind: 'attraction', refId: 'a1' }, // A
    { kind: 'meal', meal: { type: 'lunch', around: '12:00' }, durationMin: 45 },
    { kind: 'attraction', refId: 'a3' }, // A
    { kind: 'attraction', refId: 'show1' }, // show
  ]

  const out = optimizeEntries(entries, attractions, 'E', dist)

  it('keeps every entry', () => {
    expect(out.length).toBe(entries.length)
  })
  it('groups same-zone rides together (A rides adjacent)', () => {
    const refs = out.filter((e) => e.kind === 'attraction').map((e: any) => e.refId)
    const i1 = refs.indexOf('a1'), i3 = refs.indexOf('a3')
    expect(Math.abs(i1 - i3)).toBe(1) // a1 and a3 (both zone A) are consecutive
  })
  it('puts the show last (fixed-time, evening)', () => {
    const last = out[out.length - 1]
    expect(last.kind === 'attraction' && (last as any).refId).toBe('show1')
  })
  it('places the meal somewhere in the middle, not first or last', () => {
    const mi = out.findIndex((e) => e.kind === 'meal')
    expect(mi).toBeGreaterThan(0)
    expect(mi).toBeLessThan(out.length - 1)
  })
  it('orders movable attractions nearest-first from the entrance', () => {
    const refs = out.filter((e) => e.kind === 'attraction').map((e: any) => e.refId)
    // input order was [a2(B,9), a1(A,1), a3(A,1)]; nearest-first must visit the
    // zone-A points (dist 1) before a2 (zone B, dist 9 — farthest)
    expect(['a1', 'a3']).toContain(refs[0])
    expect(refs.indexOf('a2')).toBeGreaterThan(refs.indexOf('a1'))
    expect(refs.indexOf('a2')).toBeGreaterThan(refs.indexOf('a3'))
  })
})
