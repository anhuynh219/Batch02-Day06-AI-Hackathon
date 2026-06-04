import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Polyline, Popup, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useStore, zoneLatLng } from '../store/useStore'
import { ZONES_BY_ID } from '../data/zones'
import { CalibrationClickLayer, CalibrationPanel } from './Calibration'
import { loadGraphOnce, route, routedMinutes, type Graph } from '../lib/router'
import { haversineMeters, walkMinutes } from '../engine/travel'

const PARK_CENTER: [number, number] = [10.3373, 103.8539]

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
    if (it?.zoneId) {
      const p = zoneLatLng(it.zoneId)
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
      p: i.zoneId ? zoneLatLng(i.zoneId) : null,
      z: i.zoneId ? ZONES_BY_ID[i.zoneId] : null,
    }))
    .filter((s): s is { item: typeof itinerary[number]; p: { lat: number; lng: number }; z: NonNullable<typeof ZONES_BY_ID[string]> } =>
      s.p !== null && s.z != null
    )
    .map((s, idx) => ({ ...s, idx: idx + 1 }))

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
      <MapContainer center={PARK_CENTER} zoom={16} className="h-full w-full">
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
        {stops.map((s) => (
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
