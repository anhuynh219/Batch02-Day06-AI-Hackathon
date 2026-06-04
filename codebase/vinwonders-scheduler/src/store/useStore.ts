import { create } from 'zustand'
import type { ItineraryItem, PlanEntry, UserConstraints } from '../types'
import { buildItinerary } from '../engine/scheduleEngine'
import { ATTRACTIONS_BY_ID } from '../data/attractions'
import { ZONES_BY_ID, ENTRANCE } from '../data/zones'
import { walkMinutes } from '../engine/travel'
import { getGraph, route, routedMinutes, loadGraphOnce } from '../lib/router'

export type ChatMsg = { role: 'user' | 'assistant'; text: string }

const DEFAULT_CONSTRAINTS: UserConstraints = {
  arrivalTime: '09:00', departureTime: '19:30', groupSize: 2, hasKids: false,
  prefs: [], meals: [], mustDo: [], avoid: [],
}

export function zoneLatLng(zoneId: string | null): { lat: number; lng: number } | null {
  if (!zoneId) return null
  const o = useStore.getState().coordOverrides[zoneId]
  const z = ZONES_BY_ID[zoneId]
  return o ?? (z ? z.latLng : null)
}

const travel = (a: string | null, b: string | null) => {
  if (!a || !b || a === b) return 0
  const pa = zoneLatLng(a), pb = zoneLatLng(b)
  if (!pa || !pb) return 0
  // Prefer real path-following distance from the walkway graph; fall back to
  // straight-line (haversine) when the graph isn't loaded or the points are
  // in disconnected components.
  const g = getGraph()
  if (g) {
    const r = route(g, pa, pb)
    if (r) return routedMinutes(r.distanceM)
  }
  return walkMinutes(pa, pb)
}

type State = {
  messages: ChatMsg[]
  constraints: UserConstraints
  entries: PlanEntry[]
  itinerary: ItineraryItem[]
  selectedItemId: string | null
  busy: boolean
  coordOverrides: Record<string, { lat: number; lng: number }>
  calibrating: boolean
  calibratingZoneId: string | null
  lastSuggestedIds: string[]
  pushMessage: (m: ChatMsg) => void
  setConstraints: (c: Partial<UserConstraints>) => void
  setEntries: (e: PlanEntry[]) => void
  recompute: () => void
  removeItem: (id: string) => void
  toggleLock: (id: string) => void
  reorder: (fromId: string, toId: string) => void
  setSelected: (id: string | null) => void
  setBusy: (b: boolean) => void
  setCoord: (zoneId: string, lat: number, lng: number) => void
  setCalibrating: (b: boolean) => void
  setCalibratingZone: (id: string | null) => void
  setLastSuggestedIds: (ids: string[]) => void
}

export const useStore = create<State>((set, get) => ({
  messages: [],
  constraints: DEFAULT_CONSTRAINTS,
  entries: [],
  itinerary: [],
  selectedItemId: null,
  busy: false,
  coordOverrides: JSON.parse(localStorage.getItem('coordOverrides') || '{}'),
  calibrating: false,
  calibratingZoneId: null,
  lastSuggestedIds: [],
  pushMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  setConstraints: (c) => set((s) => ({ constraints: { ...s.constraints, ...c } })),
  setEntries: (e) => { set({ entries: e }); get().recompute() },
  recompute: () => set((s) => ({
    itinerary: buildItinerary({
      entries: s.entries, constraints: s.constraints,
      attractions: ATTRACTIONS_BY_ID, travel,
      entrance: { name: ENTRANCE.name, zoneId: ENTRANCE.id, durationMin: 10 },
    }),
  })),
  // itinerary[0] is the fixed entrance stop (no matching PlanEntry); real items map
  // to entries with a -offset shift. The entrance itself can't be removed/locked/moved.
  removeItem: (id) => {
    const it = get().itinerary
    const idx = it.findIndex((i) => i.id === id)
    if (idx < 0 || it[idx].type === 'entrance') return
    const offset = it[0]?.type === 'entrance' ? 1 : 0
    const entries = get().entries.slice()
    entries.splice(idx - offset, 1)
    get().setEntries(entries)
  },
  toggleLock: (id) => {
    const it = get().itinerary
    const idx = it.findIndex((i) => i.id === id)
    if (idx < 0 || it[idx].type === 'entrance') return
    const offset = it[0]?.type === 'entrance' ? 1 : 0
    const ei = idx - offset
    const entries = get().entries.slice()
    // Lock: pin to the stop's current start time. Unlock: drop the pin so the
    // engine re-sequences it normally.
    entries[ei] = entries[ei].locked
      ? { ...entries[ei], locked: false, lockedStart: undefined }
      : { ...entries[ei], locked: true, lockedStart: it[idx].startTime }
    get().setEntries(entries)
  },
  reorder: (fromId, toId) => {
    const it = get().itinerary
    const from = it.findIndex((i) => i.id === fromId)
    const to = it.findIndex((i) => i.id === toId)
    if (from < 0 || to < 0) return
    if (it[from].type === 'entrance' || it[to].type === 'entrance') return
    const offset = it[0]?.type === 'entrance' ? 1 : 0
    const entries = get().entries.slice()
    const [moved] = entries.splice(from - offset, 1)
    entries.splice(to - offset, 0, moved)
    get().setEntries(entries)
  },
  setSelected: (id) => set({ selectedItemId: id }),
  setBusy: (b) => set({ busy: b }),
  setCoord: (zoneId, lat, lng) => set((s) => {
    const next = { ...s.coordOverrides, [zoneId]: { lat, lng } }
    localStorage.setItem('coordOverrides', JSON.stringify(next))
    return { coordOverrides: next }
  }),
  setCalibrating: (b) => set({ calibrating: b }),
  setCalibratingZone: (id) => set({ calibratingZoneId: id }),
  setLastSuggestedIds: (ids) => set({ lastSuggestedIds: ids }),
}))

// Load the walkway graph once; when ready, recompute so travel times reflect
// real path distances instead of the straight-line fallback.
loadGraphOnce()
  .then(() => { if (useStore.getState().entries.length) useStore.getState().recompute() })
  .catch(() => { /* keep haversine fallback */ })
