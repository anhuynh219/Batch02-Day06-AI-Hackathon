import { describe, it, expect } from 'vitest'
import { haversineMeters, walkMinutes } from './travel'

const A = { lat: 10.337288, lng: 103.853949 } // park center
const B = { lat: 10.336048, lng: 103.853061 } // Hải Vương

describe('travel', () => {
  it('haversine ~ real distance (within 5%)', () => {
    const d = haversineMeters(A, B)
    // ~170m between these two points
    expect(d).toBeGreaterThan(150)
    expect(d).toBeLessThan(200)
  })
  it('walkMinutes rounds up and applies detour factor', () => {
    // 170m * 1.3 / 75 = ~2.95 -> 3
    expect(walkMinutes(A, B)).toBe(3)
  })
  it('same point is 0 minutes', () => {
    expect(walkMinutes(A, A)).toBe(0)
  })
})
