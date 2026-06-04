import { create } from 'zustand'
import type { ItineraryItem, PlanEntry, UserConstraints } from '../types'
import { buildItinerary } from '../engine/scheduleEngine'
import { ATTRACTIONS_BY_ID } from '../data/attractions'
import { ZONES_BY_ID, ENTRANCE } from '../data/zones'
import { walkMinutes, haversineMeters } from '../engine/travel'
import { getGraph, route, routedMinutes, loadGraphOnce } from '../lib/router'
import { optimizeEntries } from '../lib/optimizeRoute'
import { requestPlan } from '../lib/aiClient'
import type { SurveyProfile } from '../survey/types'
import { toConstraints, toPersona, toSeedPrompt } from '../survey/profileMapping'

function safeParseProfile(): SurveyProfile | null {
  try { return JSON.parse(localStorage.getItem('surveyProfile') || 'null') } catch { return null }
}

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

// Resolve a "place key" to coordinates. A key is an Attraction id OR a Zone id
// (distinct namespaces). Priority for an attraction: calibration override → its own
// latLng → its zone's latLng. For a zone key, defer to zoneLatLng. This is what makes
// each attraction a distinct point on the map / in routing, while still falling back
// to its zone when no per-point coordinate is set.
export function placeLatLng(key: string | null): { lat: number; lng: number } | null {
  if (!key) return null
  const a = ATTRACTIONS_BY_ID[key]
  if (a) {
    const o = useStore.getState().coordOverrides[key]
    return o ?? a.latLng ?? zoneLatLng(a.zoneId)
  }
  return zoneLatLng(key)
}

const travel = (a: string | null, b: string | null) => {
  if (!a || !b || a === b) return 0
  const pa = placeLatLng(a), pb = placeLatLng(b)
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

// Real walking distance in METRES between two places — cost metric for the TSP optimiser.
const placeDistMeters = (a: string, b: string) => {
  if (!a || !b || a === b) return 0
  const pa = placeLatLng(a), pb = placeLatLng(b)
  if (!pa || !pb) return 0
  const g = getGraph()
  if (g) { const r = route(g, pa, pb); if (r) return r.distanceM }
  return haversineMeters(pa, pb) * 1.3
}

// Place key of an itinerary item: its attraction id (point-level) or, failing that,
// its zone id (meals/breaks/entrance/return have no attraction of their own).
const itemKey = (it: ItineraryItem): string | null => it.refId ?? it.zoneId

function totalWalkMeters(itinerary: ItineraryItem[]): number {
  let total = 0
  let prev: string | null = null
  for (const it of itinerary) {
    const key = itemKey(it)
    if (!key) continue
    if (prev) total += placeDistMeters(prev, key)
    prev = key
  }
  return total
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
  profile: SurveyProfile | null
  persona: string
  surveyOpen: boolean
  surveyDone: boolean
  runPlan: (text: string) => Promise<void>
  completeSurvey: (profile: SurveyProfile) => Promise<void>
  skipSurvey: () => void
  openSurvey: () => void
  pushMessage: (m: ChatMsg) => void
  setConstraints: (c: Partial<UserConstraints>) => void
  resetConstraints: () => void
  setEntries: (e: PlanEntry[]) => void
  recompute: () => void
  optimize: () => void
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
  profile: safeParseProfile(),
  persona: (() => { const p = safeParseProfile(); return p ? toPersona(p) : '' })(),
  surveyOpen: !localStorage.getItem('surveyDone'),
  surveyDone: !!localStorage.getItem('surveyDone'),
  pushMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  setConstraints: (c) => set((s) => ({ constraints: { ...s.constraints, ...c } })),
  resetConstraints: () => set({ constraints: DEFAULT_CONSTRAINTS }),
  setEntries: (e) => { set({ entries: e }); get().recompute() },
  recompute: () => set((s) => ({
    itinerary: buildItinerary({
      entries: s.entries, constraints: s.constraints,
      attractions: ATTRACTIONS_BY_ID, travel,
      entrance: { name: ENTRANCE.name, zoneId: ENTRANCE.id, durationMin: 10 },
    }),
  })),
  // Reorder unlocked non-show attractions to minimise walking (TSP), keep shows at their
  // fixed times, and close the loop back to the entrance. User-triggered (augmentation).
  optimize: () => {
    const before = totalWalkMeters(get().itinerary)
    const next = optimizeEntries(get().entries, ATTRACTIONS_BY_ID, ENTRANCE.id, placeDistMeters)
    set({ entries: next })
    get().recompute()
    const after = totalWalkMeters(get().itinerary)
    const km = (m: number) => (m / 1000).toFixed(2)
    const saved = before - after
    const note = saved > 10
      ? `🧭 Đã tối ưu lộ trình — tổng đi bộ ${km(before)} km → ${km(after)} km (tiết kiệm ~${Math.round(saved)} m).`
      : `🧭 Lộ trình đã gần tối ưu — tổng đi bộ ~${km(after)} km, kết thúc tại quầy vé.`
    get().pushMessage({ role: 'assistant', text: note })
  },
  // itinerary[0] is the fixed entrance stop (no matching PlanEntry); real items map
  // to entries with a -offset shift. Entrance/return stops can't be removed/locked/moved.
  removeItem: (id) => {
    const it = get().itinerary
    const idx = it.findIndex((i) => i.id === id)
    if (idx < 0 || it[idx].type === 'entrance' || it[idx].type === 'return') return
    const offset = it[0]?.type === 'entrance' ? 1 : 0
    const entries = get().entries.slice()
    entries.splice(idx - offset, 1)
    get().setEntries(entries)
  },
  toggleLock: (id) => {
    const it = get().itinerary
    const idx = it.findIndex((i) => i.id === id)
    if (idx < 0 || it[idx].type === 'entrance' || it[idx].type === 'return') return
    const offset = it[0]?.type === 'entrance' ? 1 : 0
    const ei = idx - offset
    const entries = get().entries.slice()
    entries[ei] = { ...entries[ei], locked: !entries[ei].locked }
    get().setEntries(entries)
  },
  reorder: (fromId, toId) => {
    const it = get().itinerary
    const from = it.findIndex((i) => i.id === fromId)
    const to = it.findIndex((i) => i.id === toId)
    if (from < 0 || to < 0) return
    const fixed = (t: string) => t === 'entrance' || t === 'return'
    if (fixed(it[from].type) || fixed(it[to].type)) return
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
  runPlan: async (text) => {
    const value = text.trim()
    if (!value || get().busy) return
    const prevMessages = get().messages
    get().pushMessage({ role: 'user', text: value })
    set({ busy: true })
    const summary = get().itinerary.map((i) => `${i.startTime} ${i.title}`).join(', ')
    const history = [...prevMessages, { role: 'user' as const, text: value }]
    try {
      const r = await requestPlan(history, summary, get().persona)
      if (r.action === 'plan') get().resetConstraints()
      if (r.constraints) get().setConstraints(r.constraints)
      if (r.action === 'plan' || r.action === 'edit') {
        const raw: PlanEntry[] = (r.chosenIds ?? []).map((id) => ({ kind: 'attraction', refId: id }))
        for (const meal of r.constraints?.meals ?? []) raw.push({ kind: 'meal', meal, durationMin: 45 })
        // Tự động sắp theo điểm gần nhất trước (nearest-neighbor từ cổng), giữ show đúng giờ
        // và bữa ăn ở giữa — tránh lộ trình zigzag từ thứ tự thô của AI.
        const ordered = optimizeEntries(raw, ATTRACTIONS_BY_ID, ENTRANCE.id, placeDistMeters)
        get().setEntries(ordered)
      }
      set({ lastSuggestedIds: r.chosenIds ?? [] })
      get().pushMessage({ role: 'assistant', text: r.clarifyQuestion ? `${r.assistantText}\n${r.clarifyQuestion}` : r.assistantText })
    } catch {
      get().pushMessage({ role: 'assistant', text: 'Có lỗi kết nối, bạn thử lại nhé.' })
    } finally {
      set({ busy: false })
    }
  },
  completeSurvey: async (profile) => {
    const persona = toPersona(profile)
    localStorage.setItem('surveyProfile', JSON.stringify(profile))
    localStorage.setItem('surveyDone', '1')
    set({ profile, persona, surveyDone: true, surveyOpen: false })
    get().setConstraints(toConstraints(profile))
    await get().runPlan(toSeedPrompt(profile))
  },
  skipSurvey: () => { localStorage.setItem('surveyDone', '1'); set({ surveyDone: true, surveyOpen: false }) },
  openSurvey: () => set({ surveyOpen: true }),
}))

// Load the walkway graph once; when ready, recompute so travel times reflect
// real path distances instead of the straight-line fallback.
loadGraphOnce()
  .then(() => { if (useStore.getState().entries.length) useStore.getState().recompute() })
  .catch(() => { /* keep haversine fallback */ })
