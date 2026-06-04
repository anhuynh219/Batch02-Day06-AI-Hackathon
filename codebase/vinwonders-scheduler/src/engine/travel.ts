import type { LatLng } from '../types'

const R = 6371000 // earth radius m
const rad = (d: number) => (d * Math.PI) / 180

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

const DETOUR = 1.3
const METERS_PER_MIN = 75 // ~4.5 km/h

export function walkMinutes(a: LatLng, b: LatLng): number {
  const m = haversineMeters(a, b)
  if (m < 1) return 0
  return Math.ceil((m * DETOUR) / METERS_PER_MIN)
}
