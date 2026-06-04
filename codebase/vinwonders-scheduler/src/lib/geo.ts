import type { LatLng } from '../types'

type Geometry = { type: string; coordinates: any }

function eachCoord(coords: any, fn: (lng: number, lat: number) => void) {
  if (typeof coords[0] === 'number') { fn(coords[0], coords[1]); return }
  for (const c of coords) eachCoord(c, fn)
}

export function centroidOf(geom: Geometry): LatLng {
  let sLng = 0, sLat = 0, n = 0
  eachCoord(geom.coordinates, (lng, lat) => { sLng += lng; sLat += lat; n++ })
  return { lng: sLng / n, lat: sLat / n }
}

// Leaflet bounds order: [[minLat,minLng],[maxLat,maxLng]]
export function boundsOf(geom: Geometry): [[number, number], [number, number]] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  eachCoord(geom.coordinates, (lng, lat) => {
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng)
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat)
  })
  return [[minLat, minLng], [maxLat, maxLng]]
}
