import type { LatLng } from '../types'

// A walkable graph built from the geojson `highway` LineStrings (footway/service).
// Used to (a) estimate real walking minutes between two points and (b) draw a
// route polyline that follows the actual paths instead of a straight line.

type Node = { lat: number; lng: number }
export type Graph = {
  nodes: Node[]
  adj: number[][] // adj[i] = neighbour node indices
  w: number[][]   // w[i][k] = metres to adj[i][k]
}

const R = 6371000
const rad = (d: number) => (d * Math.PI) / 180
function hav(a: Node, b: Node): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function buildGraph(geo: any): Graph {
  const idx = new Map<string, number>()
  const nodes: Node[] = []
  const adjSet: Map<number, Map<number, number>> = new Map()
  // Merge coincident OSM nodes (shared intersections) by rounding to ~0.1m.
  const round = (n: number) => Math.round(n * 1e6) / 1e6
  const getNode = (lng: number, lat: number) => {
    const la = round(lat), ln = round(lng)
    const k = `${la},${ln}`
    let i = idx.get(k)
    if (i === undefined) {
      i = nodes.length
      idx.set(k, i)
      nodes.push({ lat: la, lng: ln })
      adjSet.set(i, new Map())
    }
    return i
  }
  for (const f of geo?.features ?? []) {
    const p = f.properties || {}
    if (f.geometry?.type === 'LineString' && p.highway) {
      const cs: [number, number][] = f.geometry.coordinates
      for (let i = 0; i < cs.length - 1; i++) {
        const a = getNode(cs[i][0], cs[i][1])
        const b = getNode(cs[i + 1][0], cs[i + 1][1])
        if (a === b) continue
        const ww = hav(nodes[a], nodes[b])
        const ma = adjSet.get(a)!, mb = adjSet.get(b)!
        ma.set(b, Math.min(ma.get(b) ?? Infinity, ww))
        mb.set(a, Math.min(mb.get(a) ?? Infinity, ww))
      }
    }
  }
  const adj: number[][] = [], w: number[][] = []
  for (let i = 0; i < nodes.length; i++) {
    const m = adjSet.get(i)!
    adj[i] = [...m.keys()]
    w[i] = adj[i].map((j) => m.get(j)!)
  }
  return { nodes, adj, w }
}

export function nearestNode(g: Graph, pt: LatLng): number {
  let best = -1, bd = Infinity
  for (let i = 0; i < g.nodes.length; i++) {
    const dx = g.nodes[i].lat - pt.lat
    const dy = g.nodes[i].lng - pt.lng
    const dd = dx * dx + dy * dy
    if (dd < bd) { bd = dd; best = i }
  }
  return best
}

// Dijkstra (binary-heap) shortest path. Returns total metres (incl. the snap from
// from/to to their nearest graph node) and the route geometry, or null if no path.
export function route(g: Graph, from: LatLng, to: LatLng): { distanceM: number; coords: LatLng[] } | null {
  if (g.nodes.length === 0) return null
  const s = nearestNode(g, from), t = nearestNode(g, to)
  if (s < 0 || t < 0) return null

  const n = g.nodes.length
  const dist = new Float64Array(n).fill(Infinity)
  const prev = new Int32Array(n).fill(-1)
  dist[s] = 0

  const heap: Array<[number, number]> = [[0, s]]
  const push = (d: number, node: number) => {
    heap.push([d, node])
    let i = heap.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heap[p][0] <= heap[i][0]) break
      ;[heap[p], heap[i]] = [heap[i], heap[p]]
      i = p
    }
  }
  const pop = (): [number, number] => {
    const top = heap[0]
    const last = heap.pop()!
    if (heap.length) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2
        let m = i
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === i) break
        ;[heap[m], heap[i]] = [heap[i], heap[m]]
        i = m
      }
    }
    return top
  }

  while (heap.length) {
    const [dd, u] = pop()
    if (u === t) break
    if (dd > dist[u]) continue
    const A = g.adj[u], W = g.w[u]
    for (let k = 0; k < A.length; k++) {
      const v = A[k], nd = dd + W[k]
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; push(nd, v) }
    }
  }

  if (!isFinite(dist[t])) return null
  const path: number[] = []
  for (let c: number = t; c !== -1; c = prev[c]) path.push(c)
  path.reverse()
  const coords: LatLng[] = [
    { lat: from.lat, lng: from.lng },
    ...path.map((i) => ({ lat: g.nodes[i].lat, lng: g.nodes[i].lng })),
    { lat: to.lat, lng: to.lng },
  ]
  const snap = hav({ lat: from.lat, lng: from.lng }, g.nodes[s]) + hav(g.nodes[t], { lat: to.lat, lng: to.lng })
  return { distanceM: dist[t] + snap, coords }
}

// Real path distance -> walking minutes (~4.5 km/h = 75 m/min). No detour factor:
// the distance already follows the real route.
export function routedMinutes(distanceM: number): number {
  if (distanceM < 1) return 0
  return Math.ceil(distanceM / 75)
}

// --- Shared singleton so both the schedule engine and the map use one graph ---
let GRAPH: Graph | null = null
let loading: Promise<Graph> | null = null

export function getGraph(): Graph | null { return GRAPH }

export function loadGraphOnce(): Promise<Graph> {
  if (GRAPH) return Promise.resolve(GRAPH)
  if (!loading) {
    loading = fetch('/vinwonder.geojson')
      .then((r) => r.json())
      .then((geo) => { GRAPH = buildGraph(geo); return GRAPH })
      .catch((e) => { loading = null; throw e })
  }
  return loading
}
