import { describe, it, expect } from 'vitest'
import { buildGraph, route } from './router'

// geojson coords are [lng, lat]. Two footways forming an L:
// (0,0) -> (0,0.001) -> (0.001,0.001)
const lGeo = {
  features: [
    { properties: { highway: 'footway' }, geometry: { type: 'LineString', coordinates: [[0, 0], [0, 0.001]] } },
    { properties: { highway: 'footway' }, geometry: { type: 'LineString', coordinates: [[0, 0.001], [0.001, 0.001]] } },
  ],
}

describe('router', () => {
  it('merges shared nodes and routes along the path', () => {
    const g = buildGraph(lGeo)
    expect(g.nodes.length).toBe(3) // shared corner merged
    const r = route(g, { lat: 0, lng: 0 }, { lat: 0.001, lng: 0.001 })
    expect(r).not.toBeNull()
    // two ~111m legs -> ~222m (vs ~157m straight diagonal)
    expect(r!.distanceM).toBeGreaterThan(180)
    expect(r!.distanceM).toBeLessThan(260)
    expect(r!.coords.length).toBeGreaterThanOrEqual(3)
  })

  it('ignores non-highway features', () => {
    const g = buildGraph({
      features: [
        { properties: { building: 'yes' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] } },
        ...lGeo.features,
      ],
    })
    expect(g.nodes.length).toBe(3)
  })

  it('returns null when endpoints are in disconnected components', () => {
    const g = buildGraph({
      features: [
        { properties: { highway: 'footway' }, geometry: { type: 'LineString', coordinates: [[0, 0], [0, 0.001]] } },
        { properties: { highway: 'footway' }, geometry: { type: 'LineString', coordinates: [[1, 1], [1, 1.001]] } },
      ],
    })
    const r = route(g, { lat: 0, lng: 0 }, { lat: 1.001, lng: 1 })
    expect(r).toBeNull()
  })
})
