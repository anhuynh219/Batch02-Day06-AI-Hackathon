import { describe, it, expect } from 'vitest'
import { centroidOf, boundsOf } from './geo'

const square = {
  type: 'Polygon',
  coordinates: [[[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]]],
} as const

describe('geo', () => {
  it('computes centroid (avg of unique vertices)', () => {
    const c = centroidOf(square as any)
    expect(c.lng).toBeCloseTo(0.8, 5) // (0+0+2+2+0)/5
    expect(c.lat).toBeCloseTo(0.8, 5)
  })
  it('computes bounds [[minLat,minLng],[maxLat,maxLng]]', () => {
    const b = boundsOf(square as any)
    expect(b).toEqual([[0, 0], [2, 2]])
  })
})
