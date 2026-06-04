import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Polyline, Popup, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useStore, placeLatLng } from '../store/useStore'
import { ZONES_BY_ID } from '../data/zones'
import { CalibrationClickLayer, CalibrationPanel } from './Calibration'
import { loadGraphOnce, route, routedMinutes, type Graph } from '../lib/router'
import { haversineMeters, walkMinutes } from '../engine/travel'

const PARK_CENTER: [number, number] = [10.3373, 103.8539]

// Khoá khung nhìn quanh khu VinWonders / đảo Phú Quốc: không cho zoom-out hay kéo bản đồ
// ra khỏi vùng này (tránh hiển thị vùng biển / lãnh thổ ngoài đảo vì lý do nhạy cảm).
// maxBounds = tường cứng (viscosity 1.0); minZoom giữ tầm nhìn luôn ở mức khu vực.
const PARK_BOUNDS: [[number, number], [number, number]] = [
  [10.320, 103.840], // SW
  [10.356, 103.870], // NE
]
const MIN_ZOOM = 15
const MAX_ZOOM = 19

function styleFeature(f: any) {
  const p = f.properties || {}
  if (p.building) return { color: '#9aa6b2', weight: 1, fillColor: '#cdd6e0', fillOpacity: 0.6 }
  if (p.highway === 'footway') return { color: '#caa46a', weight: 2 }
  if (p.highway) return { color: '#b8bfc8', weight: 2 }
  if (p.leisure === 'water_park' || p.leisure === 'swimming_pool')
    return { color: '#3aa0c8', weight: 1, fillColor: '#bfe3f0', fillOpacity: 0.5 }
  return { color: '#b8bfc8', weight: 1, fillOpacity: 0.1 }
}

function numberedIcon(n: number, color: string, selected: boolean) {
  const size = selected ? 34 : 28
  return L.divIcon({
    className: '',
    html: `<div class="map-pin" style="--pin:${color};background:${color};width:${size}px;height:${size}px;
      font-size:${selected ? 14 : 12}px;${selected ? 'outline:3px solid rgba(255,107,74,.45);outline-offset:1px;' : ''}">${n}</div>`,
    iconSize: [size, size], iconAnchor: [size / 2, size + 5],
    popupAnchor: [0, -size],
  })
}

function FlyToSelected() {
  const map = useMap()
  const selectedId = useStore((s) => s.selectedItemId)
  const itinerary = useStore((s) => s.itinerary)
  useEffect(() => {
    const it = itinerary.find((i) => i.id === selectedId)
    if (it) {
      const p = placeLatLng(it.refId ?? it.zoneId)
      if (p) map.flyTo([p.lat, p.lng], 17, { duration: 0.6 })
    }
  }, [selectedId, itinerary, map])
  return null
}

export function ParkMap() {
  const [geo, setGeo] = useState<any>(null)
  const [graph, setGraph] = useState<Graph | null>(null)
  const itinerary = useStore((s) => s.itinerary)
  const setSelected = useStore((s) => s.setSelected)
  const selectedId = useStore((s) => s.selectedItemId)

  useEffect(() => {
    fetch('/vinwonder.geojson').then((r) => r.json()).then(setGeo).catch(() => setGeo(null))
    loadGraphOnce().then(setGraph).catch(() => setGraph(null))
  }, [])

  type StopEntry = {
    item: typeof itinerary[number]
    idx: number
    p: { lat: number; lng: number }
    z: NonNullable<typeof ZONES_BY_ID[string]>
  }

  const stops: StopEntry[] = itinerary
    .map((i) => ({
      item: i,
      // Position per-point: an attraction uses its own coordinate (falling back to its
      // zone); meals/breaks/gate use their zone. Colour/label still come from the zone.
      p: placeLatLng(i.refId ?? i.zoneId),
      z: i.zoneId ? ZONES_BY_ID[i.zoneId] : null,
    }))
    .filter((s): s is { item: typeof itinerary[number]; p: { lat: number; lng: number }; z: NonNullable<typeof ZONES_BY_ID[string]> } =>
      s.p !== null && s.z != null
    )
    .map((s, idx) => ({ ...s, idx: idx + 1 }))

  // Fan out pins that resolve to the SAME coordinate (e.g. several attractions sharing a
  // zone's fallback centre) into a small ring so they don't stack — like Google Maps'
  // spiderfy. Applied to both pins and route legs (legs read s.p) so lines still touch the
  // pins. Gate stops (entrance/return) stay put. Each s here is a fresh object, and we
  // reassign s.p to a NEW object, so the underlying zone/attraction coordinates aren't mutated.
  {
    const groups = new Map<string, StopEntry[]>()
    for (const s of stops) {
      if (s.item.type === 'entrance' || s.item.type === 'return') continue
      const key = `${s.p.lat.toFixed(5)},${s.p.lng.toFixed(5)}`
      const g = groups.get(key)
      if (g) g.push(s)
      else groups.set(key, [s])
    }
    for (const g of groups.values()) {
      if (g.length < 2) continue
      const R = 0.00022 // ~24 m ring radius
      const lngScale = Math.cos((g[0].p.lat * Math.PI) / 180) || 1
      g.forEach((s, i) => {
        const ang = (2 * Math.PI * i) / g.length - Math.PI / 2
        s.p = { lat: s.p.lat + R * Math.sin(ang), lng: s.p.lng + (R / lngScale) * Math.cos(ang) }
      })
    }
  }

  // `stops` includes the closing return-to-entrance (so the route line loops back).
  // Markers exclude it to avoid a duplicate pin stacked on the entrance.
  const markerStops = stops.filter((s) => s.item.type !== 'return')

  // One route leg per consecutive pair, following the real walkways (Dijkstra over
  // the path graph; straight fallback when there's no path / graph yet). Each leg is
  // coloured by its DESTINATION zone so the route, pins and timeline cards share a
  // colour language. Falls back to a straight segment otherwise.
  type Leg = {
    coords: [number, number][]; color: string; aId: string; bId: string
    fromName: string; toName: string; minutes: number; distanceM: number; routed: boolean
  }
  const legsSig = stops.map((s) => `${s.item.id}:${s.z.color}:${s.p.lat},${s.p.lng}`).join('|')
  const legs = useMemo<Leg[]>(() => {
    const out: Leg[] = []
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1]
      const r = graph ? route(graph, a.p, b.p) : null
      const seg = r ? r.coords : [a.p, b.p]
      const distanceM = r ? r.distanceM : haversineMeters(a.p, b.p)
      const minutes = r ? routedMinutes(r.distanceM) : walkMinutes(a.p, b.p)
      out.push({
        coords: seg.map((q) => [q.lat, q.lng] as [number, number]),
        color: b.z.color, aId: a.item.id, bId: b.item.id,
        fromName: a.z.name, toName: b.z.name, minutes, distanceM, routed: !!r,
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, legsSig])

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={PARK_CENTER}
        zoom={16}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        maxBounds={PARK_BOUNDS}
        maxBoundsViscosity={1.0}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          bounds={PARK_BOUNDS}
          noWrap
        />
        {geo && (
          <GeoJSON
            data={geo}
            style={styleFeature as any}
            // Only draw paths + building/area outlines. Skip OSM Point features
            // (sculptures, fountains, info markers) so Leaflet doesn't scatter
            // non-interactive default blue pins across the map.
            filter={(f: any) => f.geometry?.type !== 'Point'}
          />
        )}
        {/* white casing under every leg for legibility */}
        {legs.map((lg, i) => (
          <Polyline key={`case-${i}`} positions={lg.coords}
            pathOptions={{ color: '#FFFDF8', weight: 8, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} />
        ))}
        {/* coloured legs (by destination zone); the leg touching the selected stop pops */}
        {legs.map((lg, i) => {
          const active = selectedId != null && (selectedId === lg.aId || selectedId === lg.bId)
          const dim = selectedId != null && !active
          return (
            <Polyline key={`leg-${i}`} positions={lg.coords} interactive={false}
              pathOptions={{ color: lg.color, weight: active ? 6 : 4, opacity: dim ? 0.4 : 0.95, lineCap: 'round', lineJoin: 'round' }} />
          )
        })}
        {/* invisible fat hit-area per leg → easy hover/click, shows a distance+time tooltip */}
        {legs.map((lg, i) => (
          <Polyline key={`hit-${i}`} positions={lg.coords}
            pathOptions={{ color: '#000', weight: 16, opacity: 0, lineCap: 'round' }}
            eventHandlers={{ click: () => setSelected(lg.bId) }}>
            <Tooltip sticky direction="top" opacity={1} className="leg-tip">
              <span className="leg-tip-time">🚶 {lg.minutes} phút</span>
              <span className="leg-tip-dist"> · {Math.round(lg.distanceM)} m</span>
              <div className="leg-tip-route">{lg.fromName} → {lg.toName}</div>
              {!lg.routed && <div className="leg-tip-note">≈ ước lượng (đường chim bay)</div>}
            </Tooltip>
          </Polyline>
        ))}
        {markerStops.map((s) => (
          <Marker
            key={s.item.id}
            position={[s.p.lat, s.p.lng]}
            icon={numberedIcon(s.idx, s.z.color, s.item.id === selectedId)}
            eventHandlers={{ click: () => setSelected(s.item.id) }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1} className="pin-tip">
              <span className="pin-tip-title">
                <span className="pin-tip-num" style={{ background: s.z.color }}>{s.idx}</span>
                {s.item.title}
              </span>
              <span className="pin-tip-sub">{s.item.startTime}–{s.item.endTime} · {s.z.name}</span>
            </Tooltip>
            <Popup>
              <b>{s.idx}. {s.item.title}</b><br />
              {s.item.startTime}–{s.item.endTime} · {s.z.name}
              {s.item.warning && <div style={{ color: '#c0392b' }}>⚠ {s.item.warning}</div>}
            </Popup>
          </Marker>
        ))}
        <FlyToSelected />
        <CalibrationClickLayer />
      </MapContainer>
      <CalibrationPanel />
    </div>
  )
}
