import type { Attraction, PlanEntry } from '../types'

// Distance in metres between two place keys (attraction id or zone id) — real walking
// distance, supplied by the caller. Used point-to-point so each attraction is its own node.
export type PlaceDist = (a: string, b: string) => number

// ---- Closed-tour TSP: start & end at node 0, visit nodes 1..n, minimise total. ----
// Exact Held-Karp for small n (a day rarely spans >6 distinct zones), nearest-neighbour
// + 2-opt fallback for larger inputs. Returns the visiting order of nodes 1..n.
export function tspOrder(n: number, M: number[][]): number[] {
  if (n <= 0) return []
  if (n === 1) return [1]
  if (n <= 12) return heldKarp(n, M)
  return twoOpt(nearestNeighbour(n, M), M)
}

function heldKarp(n: number, M: number[][]): number[] {
  const FULL = 1 << n
  const INF = Infinity
  const dp: number[][] = Array.from({ length: FULL }, () => new Array(n + 1).fill(INF))
  const par: number[][] = Array.from({ length: FULL }, () => new Array(n + 1).fill(0))
  for (let j = 1; j <= n; j++) dp[1 << (j - 1)][j] = M[0][j]
  for (let mask = 1; mask < FULL; mask++) {
    for (let j = 1; j <= n; j++) {
      if (!(mask & (1 << (j - 1)))) continue
      const cur = dp[mask][j]
      if (cur === INF) continue
      for (let k = 1; k <= n; k++) {
        if (mask & (1 << (k - 1))) continue
        const nm = mask | (1 << (k - 1))
        const nc = cur + M[j][k]
        if (nc < dp[nm][k]) { dp[nm][k] = nc; par[nm][k] = j }
      }
    }
  }
  let best = INF, last = 1
  const full = FULL - 1
  for (let j = 1; j <= n; j++) {
    const c = dp[full][j] + M[j][0]
    if (c < best) { best = c; last = j }
  }
  const order: number[] = []
  let mask = full, j = last
  while (j !== 0) {
    order.push(j)
    const pj = par[mask][j]
    mask ^= 1 << (j - 1)
    j = pj
  }
  return order.reverse()
}

function nearestNeighbour(n: number, M: number[][]): number[] {
  const visited = new Array(n + 1).fill(false)
  const order: number[] = []
  let cur = 0
  for (let step = 0; step < n; step++) {
    let best = -1, bd = Infinity
    for (let k = 1; k <= n; k++) {
      if (visited[k]) continue
      if (M[cur][k] < bd) { bd = M[cur][k]; best = k }
    }
    visited[best] = true; order.push(best); cur = best
  }
  return order
}

function twoOpt(order: number[], M: number[][]): number[] {
  const seq = order.slice()
  const cost = (a: number, b: number) => M[a][b]
  let improved = true
  while (improved) {
    improved = false
    for (let i = 0; i < seq.length - 1; i++) {
      for (let k = i + 1; k < seq.length; k++) {
        const a = i === 0 ? 0 : seq[i - 1]
        const b = seq[i]
        const c = seq[k]
        const dd = k + 1 < seq.length ? seq[k + 1] : 0
        const delta = cost(a, c) + cost(b, dd) - cost(a, b) - cost(c, dd)
        if (delta < -1e-9) {
          let lo = i, hi = k
          while (lo < hi) { const t = seq[lo]; seq[lo] = seq[hi]; seq[hi] = t; lo++; hi-- }
          improved = true
        }
      }
    }
  }
  return seq
}

// ---- Reorder a plan: visit the NEAREST unvisited point first, then progressively farther ----
// Rules (per product decision): only UNLOCKED, non-show attractions are reordered. Ordering is
// greedy NEAREST-NEIGHBOUR starting from the entrance — from the current point we always hop to
// the closest unvisited attraction (point-to-point, each attraction its own node). This is the
// intuitive "gần nhất trước rồi xa dần" order and removes the back-tracking a raw AI order can
// cause. Attractions sharing a zone naturally stay adjacent (hop between them ~free).
// Shows keep their fixed times (appended late, by showtime). Meals go to the middle. Locked
// items / breaks keep their order, appended after.
export function optimizeEntries(
  entries: PlanEntry[],
  attractions: Record<string, Attraction>,
  entranceKey: string,
  dist: PlaceDist,
): PlanEntry[] {
  const movable: { entry: PlanEntry; key: string }[] = []
  const shows: PlanEntry[] = []
  const meals: PlanEntry[] = []
  const others: PlanEntry[] = [] // breaks + locked attractions

  for (const e of entries) {
    if (e.kind === 'attraction') {
      const a = attractions[e.refId]
      if (!a) { others.push(e); continue }
      if (a.kind === 'show') { shows.push(e); continue }
      if (e.locked) { others.push(e); continue }
      movable.push({ entry: e, key: a.id })
    } else if (e.kind === 'meal') {
      meals.push(e)
    } else {
      others.push(e)
    }
  }

  let movableOrdered: PlanEntry[] = []
  if (movable.length > 0) {
    const nodes = [entranceKey, ...movable.map((m) => m.key)]
    const M = nodes.map((a) => nodes.map((b) => dist(a, b)))
    const order = nearestNeighbour(movable.length, M) // greedy nearest-first from node 0 (entrance)
    movableOrdered = order.map((i) => movable[i - 1].entry)
  }

  const result = [...movableOrdered]
  // meals into the middle of the ride sequence
  if (meals.length) {
    const mid = Math.floor(result.length / 2)
    result.splice(mid, 0, ...meals)
  }
  // breaks / locked keep order, then shows ordered by their first showtime (usually evening)
  result.push(...others)
  const showTime = (e: PlanEntry) => {
    if (e.kind !== 'attraction') return 9999
    const a = attractions[e.refId]
    const t = a?.showTimes?.[0]
    if (!t) return 9999
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  shows.sort((x, y) => showTime(x) - showTime(y))
  result.push(...shows)
  return result
}
