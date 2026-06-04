# VinWonders AI Scheduler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React web app where a tourist describes their VinWonders Phú Quốc day in natural language, Gemini extracts constraints + picks rides, a deterministic TypeScript engine builds a timed itinerary with travel buffers and warnings, and the user views/edits it on a real OSM map + draggable timeline.

**Architecture:** Hybrid AI. Gemini (via a thin backend proxy that hides the API key) does language understanding and ride selection only — it returns IDs from a fixed dataset. A pure TS `scheduleEngine` does all time math (sequencing, buffers from haversine walking time, opening-hours/show validation, too-tight warnings). Frontend = React + Leaflet (real `vinwonder.geojson` base layer + numbered route) + dnd-kit timeline + chat.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, Zustand (state), Vitest (tests), Leaflet + react-leaflet, @dnd-kit, Express + tsx (proxy server), @google/genai (Gemini SDK).

---

## Conventions

- **App root / git repo / all commands run from:** `d:\Vinuni\Lab\lab5\vinwonders-scheduler` (created in Task 0). All paths below are relative to this folder unless noted.
- **Source files:** `vinwonder.geojson` and `Vinwonder.md` live in `d:\Vinuni\Lab\lab5\` (parent). Task 0 copies the geojson into the app.
- TDD for logic (`src/engine/**`, `src/lib/**`): write failing test → run → implement → run → commit. UI tasks: build component → manual verify in browser → commit.
- Run a single test file: `npx vitest run src/engine/scheduleEngine.test.ts`. Run all: `npx vitest run`.

---

## File Structure

```text
vinwonders-scheduler/
├── server/
│   ├── index.ts          # Express app, serves POST /api/plan
│   └── gemini.ts         # Gemini call + response schema + system prompt
├── public/
│   └── vinwonder.geojson # copied from parent
├── src/
│   ├── types.ts          # all shared types
│   ├── data/
│   │   ├── zones.ts      # 6 zones (id, name, color, latLng seed)
│   │   └── attractions.ts# ~22 attractions/shows from Vinwonder.md
│   ├── engine/
│   │   ├── time.ts       # "HH:MM" <-> minutes helpers
│   │   ├── time.test.ts
│   │   ├── travel.ts     # haversine -> walking minutes
│   │   ├── travel.test.ts
│   │   ├── scheduleEngine.ts
│   │   └── scheduleEngine.test.ts
│   ├── lib/
│   │   ├── geo.ts        # geojson centroid + bounds helpers
│   │   ├── geo.test.ts
│   │   └── aiClient.ts   # fetch wrapper for /api/plan
│   ├── store/
│   │   └── useStore.ts   # zustand store
│   ├── components/
│   │   ├── AppShell.tsx
│   │   ├── ChatPanel.tsx
│   │   ├── SuggestionCards.tsx
│   │   ├── ParkMap.tsx
│   │   ├── Timeline.tsx
│   │   └── Calibration.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env                  # GEMINI_API_KEY=...  (gitignored)
├── .env.example
├── index.html
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Task 0: Project scaffold

**Files:**
- Create: whole `vinwonders-scheduler/` folder + config files listed below.

- [ ] **Step 1: Create app with Vite (React + TS) and init git**

Run from `d:\Vinuni\Lab\lab5`:
```bash
npm create vite@latest vinwonders-scheduler -- --template react-ts
cd vinwonders-scheduler
git init
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install
npm install zustand leaflet react-leaflet @dnd-kit/core @dnd-kit/sortable @google/genai express cors
npm install -D tailwindcss postcss autoprefixer vitest jsdom @types/leaflet @types/express @types/cors tsx concurrently @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Configure Tailwind**

Create `tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```
Create `postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```
Replace `src/index.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
html, body, #root { height: 100%; margin: 0; }
```

- [ ] **Step 4: Configure Vitest + dev proxy in `vite.config.ts`**

Replace `vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8787' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
})
```
Create `src/setupTests.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Copy geojson + add env + scripts**

Run:
```bash
cp ../vinwonder.geojson public/vinwonder.geojson
```
Create `.env.example`:
```text
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-2.0-flash
PORT=8787
```
Create `.env` (real key — do NOT commit):
```text
GEMINI_API_KEY=PUT_YOUR_REAL_KEY_HERE
GEMINI_MODEL=gemini-2.0-flash
PORT=8787
```
Append to `.gitignore`:
```text
.env
```
Edit `package.json` `"scripts"` to:
```json
{
  "scripts": {
    "dev": "concurrently -n web,api -c blue,green \"vite\" \"tsx watch server/index.ts\"",
    "web": "vite",
    "api": "tsx watch server/index.ts",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  }
}
```

- [ ] **Step 6: Verify scaffold runs**

Run: `npx vitest run`
Expected: "No test files found" (exit 0) — toolchain works.
Run: `npm run web` then open the printed URL; expect the default Vite page. Stop it (Ctrl+C).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite+React+TS+Tailwind+Vitest, copy geojson"
```

---

## Task 1: Shared types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write the types**

Create `src/types.ts`:
```ts
export type LatLng = { lat: number; lng: number }

export type Zone = {
  id: string
  name: string
  color: string       // hex, for map + timeline accents
  latLng: LatLng      // seed coords (refined via Calibration)
  shortDesc: string
}

export type AttractionKind =
  | 'thrill' | 'family' | 'kids' | 'water' | 'indoor' | 'show' | 'aquarium'

export type Attraction = {
  id: string
  name: string
  zoneId: string
  kind: AttractionKind
  durationMin: number
  intensity: 1 | 2 | 3 | 4 | 5
  kidFriendly: boolean
  tags: string[]
  openTime: string    // "HH:MM"
  closeTime: string   // "HH:MM"
  showTimes?: string[] // only for kind==='show', e.g. ["18:30"]
}

export type ItineraryItemType = 'ride' | 'show' | 'meal' | 'break'

export type ItineraryItem = {
  id: string
  refId: string | null   // Attraction.id, or null for meal/break
  type: ItineraryItemType
  title: string
  zoneId: string | null
  startTime: string      // "HH:MM"
  endTime: string        // "HH:MM"
  locked: boolean
  warning?: string
}

export type Meal = { type: 'lunch' | 'dinner' | 'snack'; around: string }

export type UserConstraints = {
  arrivalTime: string
  departureTime: string
  groupSize: number
  hasKids: boolean
  prefs: string[]
  meals: Meal[]
  mustDo: string[]
  avoid: string[]
}

// What the engine consumes: an ordered list of plan entries.
export type PlanEntry =
  | { kind: 'attraction'; refId: string; locked?: boolean }
  | { kind: 'meal'; meal: Meal; durationMin: number; zoneId?: string | null; locked?: boolean }
  | { kind: 'break'; durationMin: number; locked?: boolean }

// Gemini's structured response (mirrored in server/gemini.ts schema)
export type PlanResponse = {
  action: 'plan' | 'edit' | 'clarify'
  constraints?: Partial<UserConstraints>
  chosenIds?: string[]
  clarifyQuestion?: string
  assistantText: string
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared domain types"
```

---

## Task 2: Time helpers (TDD)

**Files:**
- Create: `src/engine/time.ts`
- Test: `src/engine/time.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/engine/time.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { toMinutes, toHHMM, addMinutes } from './time'

describe('time helpers', () => {
  it('parses HH:MM to minutes', () => {
    expect(toMinutes('09:00')).toBe(540)
    expect(toMinutes('19:30')).toBe(1170)
  })
  it('formats minutes to HH:MM zero-padded', () => {
    expect(toHHMM(540)).toBe('09:00')
    expect(toHHMM(1170)).toBe('19:30')
  })
  it('adds minutes', () => {
    expect(addMinutes('09:50', 20)).toBe('10:10')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/time.test.ts`
Expected: FAIL (cannot find module './time').

- [ ] **Step 3: Implement**

Create `src/engine/time.ts`:
```ts
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function toHHMM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function addMinutes(hhmm: string, delta: number): string {
  return toHHMM(toMinutes(hhmm) + delta)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/time.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/time.ts src/engine/time.test.ts
git commit -m "feat: add time HH:MM helpers"
```

---

## Task 3: Travel time (TDD)

**Files:**
- Create: `src/engine/travel.ts`
- Test: `src/engine/travel.test.ts`

Travel minutes between two coords: haversine metres × 1.3 detour factor ÷ walking speed (75 m/min ≈ 4.5 km/h), rounded up, minimum 2 min when zones differ.

- [ ] **Step 1: Write failing tests**

Create `src/engine/travel.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/travel.test.ts`
Expected: FAIL (cannot find module './travel').

- [ ] **Step 3: Implement**

Create `src/engine/travel.ts`:
```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/travel.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/travel.ts src/engine/travel.test.ts
git commit -m "feat: add haversine walking-time travel util"
```

---

## Task 4: Dataset — zones + attractions

**Files:**
- Create: `src/data/zones.ts`, `src/data/attractions.ts`
- Test: `src/data/dataset.test.ts`

Source content: [Vinwonder.md](../../../Vinwonder.md). Coords are seeds near park center `(10.3373, 103.8539)`; refined later via Calibration (Task 12). Park hours 09:00–19:30.

- [ ] **Step 1: Create zones**

Create `src/data/zones.ts`:
```ts
import type { Zone } from '../types'

export const ZONES: Zone[] = [
  { id: 'european', name: 'Đại lộ châu Âu', color: '#e0533d', latLng: { lat: 10.33760, lng: 103.85470 }, shortDesc: 'Phố châu Âu trung cổ, show Once, lâu đài' },
  { id: 'tornado',  name: 'Thế giới lốc xoáy', color: '#2f9fd0', latLng: { lat: 10.33700, lng: 103.85250 }, shortDesc: 'Công viên nước lớn nhất ĐNA' },
  { id: 'viking',   name: 'Khu làng bí mật', color: '#d0a02f', latLng: { lat: 10.33820, lng: 103.85360 }, shortDesc: 'Làng Viking, zipline, thử thách vận động' },
  { id: 'neptune',  name: 'Cung điện Hải Vương', color: '#46b37a', latLng: { lat: 10.33605, lng: 103.85306 }, shortDesc: 'Thuỷ cung top 5 thế giới (kiến trúc rùa)' },
  { id: 'adventure',name: 'Thế giới phiêu lưu', color: '#7a5cd0', latLng: { lat: 10.33650, lng: 103.85550 }, shortDesc: 'Maya, Hy Lạp, rừng Amazon, tàu lượn Zeus' },
  { id: 'wonder',   name: 'Thế giới diệu kỳ', color: '#d04f9f', latLng: { lat: 10.33560, lng: 103.85440 }, shortDesc: 'Cổ tích, Ba Tư, Ai Cập, miền Tây' },
]

export const ZONES_BY_ID: Record<string, Zone> =
  Object.fromEntries(ZONES.map((z) => [z.id, z]))
```

- [ ] **Step 2: Create attractions**

Create `src/data/attractions.ts`:
```ts
import type { Attraction } from '../types'

const H = { open: '09:00', close: '19:30' }
const A = (
  id: string, name: string, zoneId: string,
  kind: Attraction['kind'], durationMin: number, intensity: Attraction['intensity'],
  kidFriendly: boolean, tags: string[], showTimes?: string[],
): Attraction => ({
  id, name, zoneId, kind, durationMin, intensity, kidFriendly, tags,
  openTime: H.open, closeTime: kind === 'show' ? '19:30' : H.close, showTimes,
})

export const ATTRACTIONS: Attraction[] = [
  // Đại lộ châu Âu
  A('once-show', 'Show Once (Quảng trường Phượng Hoàng Lửa)', 'european', 'show', 35, 2, true, ['show','ánh sáng','check-in'], ['18:30']),
  A('ac-long', 'Lời nguyền ác long', 'european', 'indoor', 25, 3, true, ['trong nhà','tương tác','nhập vai']),
  // Thế giới lốc xoáy (water park)
  A('song-than-oahu', 'Sóng thần Oahu', 'tornado', 'water', 30, 3, true, ['nước','gia đình']),
  A('noc-doc-mang-xa', 'Đường trượt Nọc độc mãng xà (175m)', 'tornado', 'water', 20, 5, false, ['nước','cảm giác mạnh']),
  A('water-general', 'Khu trượt nước tổng hợp', 'tornado', 'water', 60, 3, true, ['nước','gia đình','nghỉ ngơi']),
  // Khu làng bí mật (Viking)
  A('lang-chien-binh', 'Ngôi làng chiến binh', 'viking', 'family', 30, 2, true, ['vận động','gia đình']),
  A('than-sam', 'Thử thách thần sấm', 'viking', 'thrill', 25, 4, false, ['vận động','cảm giác mạnh']),
  A('zipline', 'Zipline xuyên rừng (cao 10m)', 'viking', 'thrill', 15, 4, false, ['cảm giác mạnh','ngoài trời']),
  // Cung điện Hải Vương
  A('aquarium', 'Tham quan Cung điện Hải Vương', 'neptune', 'aquarium', 50, 1, true, ['trong nhà','gia đình','nghỉ ngơi','check-in']),
  // Thế giới phiêu lưu
  A('maya', 'Huyền thoại Maya (trượt trong nhà tối)', 'adventure', 'thrill', 20, 4, false, ['trong nhà','cảm giác mạnh']),
  A('zeus', 'Cơn thịnh nộ của Zeus (tàu lượn 110km/h)', 'adventure', 'thrill', 15, 5, false, ['cảm giác mạnh','tàu lượn']),
  A('icarus', 'Đôi cánh Icarus', 'adventure', 'thrill', 15, 4, false, ['cảm giác mạnh']),
  A('arena', 'Chúa tể đấu trường', 'adventure', 'thrill', 15, 4, false, ['cảm giác mạnh']),
  A('achilles', 'Khiên thần Achilles', 'adventure', 'family', 15, 3, true, ['gia đình']),
  A('amazon', 'Vượt thác rừng Amazon (cao 30m)', 'adventure', 'water', 20, 4, false, ['nước','cảm giác mạnh']),
  // Thế giới diệu kỳ
  A('thumbelina', 'Đu quay Thumbelina (Vương quốc kỳ thú)', 'wonder', 'kids', 15, 1, true, ['trẻ em','check-in']),
  A('aladdin', 'Ốc đảo bí ẩn + rạp phim bay', 'wonder', 'family', 30, 2, true, ['trong nhà','gia đình']),
  A('ai-cap', 'Thung lũng cổ đại (Ai Cập)', 'wonder', 'thrill', 20, 3, false, ['cảm giác mạnh','công nghệ']),
  A('ac-dieu', 'Hạ gục ác điểu', 'wonder', 'thrill', 15, 4, false, ['cảm giác mạnh']),
  A('dai-bang', 'Sải cánh đại bàng', 'wonder', 'thrill', 15, 4, false, ['cảm giác mạnh']),
  A('mien-tay', 'Tàu tốc hành viễn Tây', 'wonder', 'family', 20, 3, true, ['gia đình','miền Tây']),
  A('tay-sung', 'Tay súng cự phách (bắn súng tương tác)', 'wonder', 'family', 15, 2, true, ['gia đình','tương tác']),
]

export const ATTRACTIONS_BY_ID: Record<string, Attraction> =
  Object.fromEntries(ATTRACTIONS.map((a) => [a.id, a]))
```

- [ ] **Step 3: Write dataset integrity test**

Create `src/data/dataset.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { ATTRACTIONS } from './attractions'
import { ZONES_BY_ID } from './zones'

describe('dataset integrity', () => {
  it('every attraction references an existing zone', () => {
    for (const a of ATTRACTIONS) {
      expect(ZONES_BY_ID[a.zoneId], `${a.id} -> ${a.zoneId}`).toBeTruthy()
    }
  })
  it('attraction ids are unique', () => {
    const ids = ATTRACTIONS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('shows have showTimes, non-shows do not', () => {
    for (const a of ATTRACTIONS) {
      if (a.kind === 'show') expect(a.showTimes?.length).toBeGreaterThan(0)
      else expect(a.showTimes).toBeUndefined()
    }
  })
})
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/data/dataset.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/
git commit -m "feat: add zones + attractions dataset from Vinwonder.md"
```

---

## Task 5: Schedule engine (TDD) — the core

**Files:**
- Create: `src/engine/scheduleEngine.ts`
- Test: `src/engine/scheduleEngine.test.ts`

The engine takes ordered `PlanEntry[]` + constraints + a `travelMinutes(zoneA, zoneB)` function and returns timed `ItineraryItem[]`. Rules: walk buffer between different zones; shows pin to the nearest showtime ≥ arrival; warnings for closed-hours, exceed-departure, and not-making-a-show.

- [ ] **Step 1: Write failing tests**

Create `src/engine/scheduleEngine.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildItinerary } from './scheduleEngine'
import type { Attraction, PlanEntry, UserConstraints } from '../types'

const mkAttr = (p: Partial<Attraction> & Pick<Attraction,'id'|'zoneId'>): Attraction => ({
  name: p.id, kind: 'ride' as any, durationMin: 30, intensity: 3, kidFriendly: true,
  tags: [], openTime: '09:00', closeTime: '19:30', ...p,
}) as Attraction

const attrs: Record<string, Attraction> = {
  r1: mkAttr({ id: 'r1', zoneId: 'A', durationMin: 30 }),
  r2: mkAttr({ id: 'r2', zoneId: 'B', durationMin: 20 }),
  late: mkAttr({ id: 'late', zoneId: 'A', durationMin: 30, openTime: '09:00', closeTime: '19:30' }),
  show: mkAttr({ id: 'show', zoneId: 'A', kind: 'show', durationMin: 35, showTimes: ['18:30'] }),
}

const baseConstraints: UserConstraints = {
  arrivalTime: '09:00', departureTime: '19:30', groupSize: 2, hasKids: false,
  prefs: [], meals: [], mustDo: [], avoid: [],
}

// travel: 10 min between different zones, 0 if same
const travel = (a: string | null, b: string | null) => (a && b && a !== b ? 10 : 0)

describe('buildItinerary', () => {
  it('sequences two rides, no leading buffer, buffer between different zones', () => {
    const entries: PlanEntry[] = [
      { kind: 'attraction', refId: 'r1' },
      { kind: 'attraction', refId: 'r2' },
    ]
    const items = buildItinerary({ entries, constraints: baseConstraints, attractions: attrs, travel })
    expect(items[0].startTime).toBe('09:00')
    expect(items[0].endTime).toBe('09:30')
    expect(items[1].startTime).toBe('09:40') // 09:30 + 10 buffer
    expect(items[1].endTime).toBe('10:00')
    expect(items[0].warning).toBeUndefined()
  })

  it('pins a show to its showtime', () => {
    const entries: PlanEntry[] = [{ kind: 'attraction', refId: 'show' }]
    const items = buildItinerary({ entries, constraints: baseConstraints, attractions: attrs, travel })
    expect(items[0].type).toBe('show')
    expect(items[0].startTime).toBe('18:30')
    expect(items[0].endTime).toBe('19:05')
  })

  it('warns when an item ends after closing time', () => {
    const c = { ...baseConstraints, arrivalTime: '19:10' }
    const entries: PlanEntry[] = [{ kind: 'attraction', refId: 'late' }] // 19:10-19:40 > 19:30
    const items = buildItinerary({ entries, constraints: c, attractions: attrs, travel })
    expect(items[0].warning).toMatch(/đóng cửa/i)
  })

  it('warns when itinerary exceeds departure time', () => {
    const c = { ...baseConstraints, departureTime: '09:20' }
    const entries: PlanEntry[] = [{ kind: 'attraction', refId: 'r1' }] // ends 09:30 > 09:20
    const items = buildItinerary({ entries, constraints: c, attractions: attrs, travel })
    expect(items[0].warning).toMatch(/giờ về/i)
  })

  it('warns when you cannot reach a show in time', () => {
    // arrive 18:25, need 10 min travel -> 18:35 > 18:30 showtime
    const c = { ...baseConstraints, arrivalTime: '18:00' }
    const entries: PlanEntry[] = [
      { kind: 'attraction', refId: 'r2' }, // zone B 18:00-18:20
      { kind: 'attraction', refId: 'show' }, // zone A, needs 10 buffer -> 18:30 reachable at 18:30 exactly
    ]
    const items = buildItinerary({ entries, constraints: c, attractions: attrs, travel })
    expect(items[1].startTime).toBe('18:30')
    // tighten: start r2 later so show is unreachable
    const c2 = { ...baseConstraints, arrivalTime: '18:15' }
    const items2 = buildItinerary({ entries, constraints: c2, attractions: attrs, travel })
    // r2 18:15-18:35, +10 travel = 18:45 > 18:30 -> warn
    expect(items2[1].warning).toMatch(/không kịp/i)
  })

  it('inserts meal entries with their duration', () => {
    const entries: PlanEntry[] = [
      { kind: 'attraction', refId: 'r1' },
      { kind: 'meal', meal: { type: 'lunch', around: '12:00' }, durationMin: 45, zoneId: 'A' },
    ]
    const items = buildItinerary({ entries, constraints: baseConstraints, attractions: attrs, travel })
    expect(items[1].type).toBe('meal')
    expect(items[1].startTime).toBe('09:30')
    expect(items[1].endTime).toBe('10:15')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/scheduleEngine.test.ts`
Expected: FAIL (cannot find module './scheduleEngine').

- [ ] **Step 3: Implement**

Create `src/engine/scheduleEngine.ts`:
```ts
import type { Attraction, ItineraryItem, PlanEntry, UserConstraints } from '../types'
import { toMinutes, toHHMM } from './time'

let _seq = 0
const nextId = () => `it-${++_seq}`

type Args = {
  entries: PlanEntry[]
  constraints: UserConstraints
  attractions: Record<string, Attraction>
  travel: (zoneA: string | null, zoneB: string | null) => number
}

export function buildItinerary({ entries, constraints, attractions, travel }: Args): ItineraryItem[] {
  const items: ItineraryItem[] = []
  const departure = toMinutes(constraints.departureTime)
  let cursor = toMinutes(constraints.arrivalTime)
  let prevZone: string | null = null

  for (const entry of entries) {
    if (entry.kind === 'attraction') {
      const a = attractions[entry.refId]
      if (!a) continue
      const buffer = travel(prevZone, a.zoneId)
      let start = cursor + buffer
      const warnings: string[] = []

      if (a.kind === 'show' && a.showTimes?.length) {
        const show = a.showTimes.map(toMinutes).find((t) => t >= cursor) ?? toMinutes(a.showTimes[0])
        if (start > show) warnings.push('Có thể không kịp giờ show — cần tới sớm hơn')
        start = show
      }

      const end = start + a.durationMin
      if (start < toMinutes(a.openTime) || end > toMinutes(a.closeTime)) {
        warnings.push('Trò này đã đóng cửa vào khung giờ đó')
      }
      if (end > departure) warnings.push('Vượt quá giờ về dự kiến')

      items.push({
        id: nextId(), refId: a.id, type: a.kind === 'show' ? 'show' : 'ride',
        title: a.name, zoneId: a.zoneId, startTime: toHHMM(start), endTime: toHHMM(end),
        locked: !!entry.locked, warning: warnings[0],
      })
      cursor = end
      prevZone = a.zoneId
    } else if (entry.kind === 'meal') {
      const buffer = travel(prevZone, entry.zoneId ?? prevZone)
      const start = cursor + buffer
      const end = start + entry.durationMin
      const warning = end > departure ? 'Vượt quá giờ về dự kiến' : undefined
      items.push({
        id: nextId(), refId: null, type: 'meal',
        title: `Ăn ${entry.meal.type === 'lunch' ? 'trưa' : entry.meal.type === 'dinner' ? 'tối' : 'nhẹ'}`,
        zoneId: entry.zoneId ?? null, startTime: toHHMM(start), endTime: toHHMM(end),
        locked: !!entry.locked, warning,
      })
      cursor = end
      prevZone = entry.zoneId ?? prevZone
    } else {
      const start = cursor
      const end = start + entry.durationMin
      items.push({
        id: nextId(), refId: null, type: 'break', title: 'Nghỉ ngơi',
        zoneId: prevZone, startTime: toHHMM(start), endTime: toHHMM(end),
        locked: !!entry.locked,
      })
      cursor = end
    }
  }
  return items
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/scheduleEngine.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/scheduleEngine.ts src/engine/scheduleEngine.test.ts
git commit -m "feat: add schedule engine with buffers, shows, warnings"
```

---

## Task 6: Geo helpers (TDD)

**Files:**
- Create: `src/lib/geo.ts`
- Test: `src/lib/geo.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/geo.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { centroidOf, boundsOf } from './geo'

const square = {
  type: 'Polygon',
  coordinates: [[[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]]],
} as const

describe('geo', () => {
  it('computes centroid (avg of unique vertices)', () => {
    const c = centroidOf(square as any)
    expect(c.lng).toBeCloseTo(0.8, 5) // (0+0+2+2+0)/5
    expect(c.lat).toBeCloseTo(0.8, 5)
  })
  it('computes bounds [[minLat,minLng],[maxLat,maxLng]]', () => {
    const b = boundsOf(square as any)
    expect(b).toEqual([[0, 0], [2, 2]])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/geo.test.ts`
Expected: FAIL (cannot find module './geo').

- [ ] **Step 3: Implement**

Create `src/lib/geo.ts`:
```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/geo.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo.ts src/lib/geo.test.ts
git commit -m "feat: add geojson centroid + bounds helpers"
```

---

## Task 7: Backend AI proxy (Gemini)

**Files:**
- Create: `server/gemini.ts`, `server/index.ts`

The proxy receives conversation + current itinerary + a compact dataset menu, asks Gemini for a structured `PlanResponse`, validates `chosenIds` against the dataset, and returns it. Gemini never sees the API key in the browser.

- [ ] **Step 1: Implement Gemini call + schema**

Create `server/gemini.ts`:
```ts
import { GoogleGenAI, Type } from '@google/genai'
import type { PlanResponse } from '../src/types'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: ['plan', 'edit', 'clarify'] },
    chosenIds: { type: Type.ARRAY, items: { type: Type.STRING } },
    clarifyQuestion: { type: Type.STRING },
    assistantText: { type: Type.STRING },
    constraints: {
      type: Type.OBJECT,
      properties: {
        arrivalTime: { type: Type.STRING },
        departureTime: { type: Type.STRING },
        groupSize: { type: Type.NUMBER },
        hasKids: { type: Type.BOOLEAN },
        prefs: { type: Type.ARRAY, items: { type: Type.STRING } },
        mustDo: { type: Type.ARRAY, items: { type: Type.STRING } },
        avoid: { type: Type.ARRAY, items: { type: Type.STRING } },
        meals: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['lunch', 'dinner', 'snack'] },
              around: { type: Type.STRING },
            },
          },
        },
      },
    },
  },
  required: ['action', 'assistantText'],
}

function systemPrompt(menu: string): string {
  return `Bạn là trợ lý lập lịch vui chơi tại VinWonders Phú Quốc. NHIỆM VỤ:
- Đọc yêu cầu của khách (ngôn ngữ tự nhiên, tiếng Việt).
- Trích "constraints" (giờ đến, giờ về, số người, có trẻ nhỏ, sở thích).
- CHỌN trò chơi BẰNG ĐÚNG "id" trong DANH SÁCH dưới đây. TUYỆT ĐỐI KHÔNG bịa id hay tên mới, KHÔNG tự tính giờ (hệ thống khác lo việc tính giờ).
- Nếu yêu cầu quá mơ hồ (vd "có trò nào vui không") -> action="clarify" và đặt 1-2 câu hỏi ngắn trong clarifyQuestion.
- Nếu đã đủ thông tin -> action="plan" (lịch mới) hoặc "edit" (sửa lịch hiện có), điền chosenIds theo THỨ TỰ chơi hợp lý.
- assistantText: lời nhắn thân thiện, ngắn gọn cho khách (giải thích vì sao chọn các trò này).

DANH SÁCH TRÒ CHƠI (id — tên — khu — loại — phút — cường độ — hợp trẻ em):
${menu}`
}

export async function askGemini(opts: {
  messages: { role: 'user' | 'assistant'; text: string }[]
  itinerarySummary: string
  menu: string
}): Promise<PlanResponse> {
  const contents = opts.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }))
  contents.push({
    role: 'user',
    parts: [{ text: `Lịch hiện tại:\n${opts.itinerarySummary || '(chưa có)'}` }],
  })

  const res = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt(opts.menu),
      responseMimeType: 'application/json',
      responseSchema,
    },
  })
  const text = res.text ?? '{}'
  return JSON.parse(text) as PlanResponse
}
```

- [ ] **Step 2: Implement Express server with validation + retry**

Create `server/index.ts`:
```ts
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { askGemini } from './gemini'
import { ATTRACTIONS, ATTRACTIONS_BY_ID } from '../src/data/attractions'
import { ZONES_BY_ID } from '../src/data/zones'
import type { PlanResponse } from '../src/types'

const app = express()
app.use(cors())
app.use(express.json())

const menu = ATTRACTIONS.map((a) =>
  `${a.id} — ${a.name} — ${ZONES_BY_ID[a.zoneId].name} — ${a.kind} — ${a.durationMin}p — cường độ ${a.intensity} — ${a.kidFriendly ? 'hợp trẻ em' : 'không hợp trẻ nhỏ'}`,
).join('\n')

app.post('/api/plan', async (req, res) => {
  const { messages = [], itinerarySummary = '' } = req.body ?? {}
  try {
    let out: PlanResponse | null = null
    for (let attempt = 0; attempt < 2 && !out; attempt++) {
      try {
        const r = await askGemini({ messages, itinerarySummary, menu })
        // validate chosenIds against dataset
        if (r.chosenIds) r.chosenIds = r.chosenIds.filter((id) => ATTRACTIONS_BY_ID[id])
        out = r
      } catch (e) {
        if (attempt === 1) throw e
      }
    }
    res.json(out)
  } catch (e: any) {
    console.error('plan error', e?.message)
    res.status(200).json({
      action: 'clarify',
      assistantText: 'Xin lỗi, mình gặp trục trặc khi xử lý. Bạn thử nói lại yêu cầu ngắn gọn hơn nhé?',
      clarifyQuestion: 'Bạn muốn chơi từ mấy giờ tới mấy giờ, đoàn có trẻ nhỏ không?',
    } satisfies PlanResponse)
  }
})

const PORT = Number(process.env.PORT) || 8787
app.listen(PORT, () => console.log(`[api] listening on http://localhost:${PORT}`))
```

Install dotenv: `npm install dotenv`

- [ ] **Step 3: Manual smoke test**

Put a real key in `.env`. Run: `npm run api`
In another terminal:
```bash
curl -s -X POST http://localhost:8787/api/plan -H "Content-Type: application/json" -d "{\"messages\":[{\"role\":\"user\",\"text\":\"Đoàn 4 người có 1 bé 6 tuổi, đến 9h về 14h, thích nhẹ nhàng và xem show\"}],\"itinerarySummary\":\"\"}"
```
Expected: JSON with `action`, `assistantText`, and `chosenIds` containing real ids (e.g. `aquarium`, `once-show`). Stop the server.

- [ ] **Step 4: Commit**

```bash
git add server/ package.json package-lock.json
git commit -m "feat: add Gemini-backed /api/plan proxy with validation + retry"
```

---

## Task 8: Frontend AI client + Zustand store

**Files:**
- Create: `src/lib/aiClient.ts`, `src/store/useStore.ts`

- [ ] **Step 1: AI client**

Create `src/lib/aiClient.ts`:
```ts
import type { PlanResponse } from '../types'

export async function requestPlan(
  messages: { role: 'user' | 'assistant'; text: string }[],
  itinerarySummary: string,
): Promise<PlanResponse> {
  const res = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, itinerarySummary }),
  })
  return res.json()
}
```

- [ ] **Step 2: Store**

Create `src/store/useStore.ts`:
```ts
import { create } from 'zustand'
import type { ItineraryItem, PlanEntry, UserConstraints } from '../types'
import { buildItinerary } from '../engine/scheduleEngine'
import { ATTRACTIONS_BY_ID } from '../data/attractions'
import { ZONES_BY_ID } from '../data/zones'
import { walkMinutes } from '../engine/travel'

export type ChatMsg = { role: 'user' | 'assistant'; text: string }

const DEFAULT_CONSTRAINTS: UserConstraints = {
  arrivalTime: '09:00', departureTime: '19:30', groupSize: 2, hasKids: false,
  prefs: [], meals: [], mustDo: [], avoid: [],
}

const travel = (a: string | null, b: string | null) => {
  if (!a || !b || a === b) return 0
  const za = ZONES_BY_ID[a], zb = ZONES_BY_ID[b]
  if (!za || !zb) return 0
  return walkMinutes(za.latLng, zb.latLng)
}

type State = {
  messages: ChatMsg[]
  constraints: UserConstraints
  entries: PlanEntry[]
  itinerary: ItineraryItem[]
  selectedItemId: string | null
  busy: boolean
  pushMessage: (m: ChatMsg) => void
  setConstraints: (c: Partial<UserConstraints>) => void
  setEntries: (e: PlanEntry[]) => void
  recompute: () => void
  removeItem: (id: string) => void
  toggleLock: (id: string) => void
  reorder: (fromId: string, toId: string) => void
  setSelected: (id: string | null) => void
  setBusy: (b: boolean) => void
}

export const useStore = create<State>((set, get) => ({
  messages: [],
  constraints: DEFAULT_CONSTRAINTS,
  entries: [],
  itinerary: [],
  selectedItemId: null,
  busy: false,
  pushMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  setConstraints: (c) => set((s) => ({ constraints: { ...s.constraints, ...c } })),
  setEntries: (e) => { set({ entries: e }); get().recompute() },
  recompute: () => set((s) => ({
    itinerary: buildItinerary({
      entries: s.entries, constraints: s.constraints,
      attractions: ATTRACTIONS_BY_ID, travel,
    }),
  })),
  removeItem: (id) => {
    const idx = get().itinerary.findIndex((i) => i.id === id)
    if (idx < 0) return
    const entries = get().entries.slice()
    entries.splice(idx, 1)
    get().setEntries(entries)
  },
  toggleLock: (id) => {
    const idx = get().itinerary.findIndex((i) => i.id === id)
    if (idx < 0) return
    const entries = get().entries.slice()
    entries[idx] = { ...entries[idx], locked: !entries[idx].locked }
    get().setEntries(entries)
  },
  reorder: (fromId, toId) => {
    const items = get().itinerary
    const from = items.findIndex((i) => i.id === fromId)
    const to = items.findIndex((i) => i.id === toId)
    if (from < 0 || to < 0) return
    const entries = get().entries.slice()
    const [moved] = entries.splice(from, 1)
    entries.splice(to, 0, moved)
    get().setEntries(entries)
  },
  setSelected: (id) => set({ selectedItemId: id }),
  setBusy: (b) => set({ busy: b }),
}))
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/aiClient.ts src/store/useStore.ts
git commit -m "feat: add AI client + zustand store with recompute"
```

---

## Task 9: AppShell layout (Layout B)

**Files:**
- Create: `src/components/AppShell.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`

Layout B: Chat left (~34%), right column = Map (top ~55%) + Timeline (bottom).

- [ ] **Step 1: AppShell**

Create `src/components/AppShell.tsx`:
```tsx
import { ChatPanel } from './ChatPanel'
import { ParkMap } from './ParkMap'
import { Timeline } from './Timeline'

export function AppShell() {
  return (
    <div className="h-full flex bg-slate-100 text-slate-800">
      <aside className="w-[34%] min-w-[320px] border-r border-slate-300 bg-white flex flex-col">
        <header className="px-4 py-3 border-b border-slate-200">
          <h1 className="font-bold text-lg">🎡 VinWonders Planner</h1>
          <p className="text-xs text-slate-500">Trợ lý AI lập lịch vui chơi Phú Quốc</p>
        </header>
        <ChatPanel />
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        <div className="h-[55%] border-b border-slate-300"><ParkMap /></div>
        <div className="flex-1 overflow-hidden"><Timeline /></div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Wire App + main**

Replace `src/App.tsx`:
```tsx
import { AppShell } from './components/AppShell'
export default function App() { return <AppShell /> }
```
Ensure `src/main.tsx` imports `./index.css` and Leaflet CSS:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import 'leaflet/dist/leaflet.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)
```

- [ ] **Step 3: Commit (compiles after Tasks 10-11 add the components)**

> Note: ChatPanel/ParkMap/Timeline are created in later tasks. To keep the build green, create temporary stubs now and replace them:
Create stub `src/components/ChatPanel.tsx`, `src/components/ParkMap.tsx`, `src/components/Timeline.tsx` each:
```tsx
export function ChatPanel() { return <div className="p-4 text-sm text-slate-400">Chat…</div> }
```
(adjust the exported name per file: `ParkMap`, `Timeline`.)

Run: `npx tsc --noEmit` → no errors. Then:
```bash
git add src/components/ src/App.tsx src/main.tsx
git commit -m "feat: add AppShell layout B + component stubs"
```

---

## Task 10: ParkMap (Leaflet + geojson + numbered route)

**Files:**
- Modify: `src/components/ParkMap.tsx`

Renders OSM tiles, the real `vinwonder.geojson` base layer (paths + buildings), numbered markers for itinerary stops, a route polyline in order, and flies to the selected item.

- [ ] **Step 1: Implement ParkMap**

Replace `src/components/ParkMap.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useStore } from '../store/useStore'
import { ZONES_BY_ID } from '../data/zones'

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

function numberedIcon(n: number, color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};color:#fff;width:26px;height:26px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;font-weight:700;border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.4)">${n}</div>`,
    iconSize: [26, 26], iconAnchor: [13, 13],
  })
}

function FlyToSelected() {
  const map = useMap()
  const selectedId = useStore((s) => s.selectedItemId)
  const itinerary = useStore((s) => s.itinerary)
  useEffect(() => {
    const it = itinerary.find((i) => i.id === selectedId)
    if (it?.zoneId && ZONES_BY_ID[it.zoneId]) {
      const z = ZONES_BY_ID[it.zoneId]
      map.flyTo([z.latLng.lat, z.latLng.lng], 17, { duration: 0.6 })
    }
  }, [selectedId, itinerary, map])
  return null
}

export function ParkMap() {
  const [geo, setGeo] = useState<any>(null)
  const itinerary = useStore((s) => s.itinerary)
  const setSelected = useStore((s) => s.setSelected)

  useEffect(() => {
    fetch('/vinwonder.geojson').then((r) => r.json()).then(setGeo).catch(() => setGeo(null))
  }, [])

  const stops = itinerary
    .filter((i) => i.zoneId && ZONES_BY_ID[i.zoneId])
    .map((i, idx) => ({ item: i, idx: idx + 1, z: ZONES_BY_ID[i.zoneId!] }))
  const line = stops.map((s) => [s.z.latLng.lat, s.z.latLng.lng]) as [number, number][]

  return (
    <MapContainer center={PARK_CENTER} zoom={16} className="h-full w-full">
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {geo && <GeoJSON data={geo} style={styleFeature as any} />}
      {line.length > 1 && <Polyline positions={line} pathOptions={{ color: '#e0533d', weight: 3, dashArray: '6 8' }} />}
      {stops.map((s) => (
        <Marker
          key={s.item.id}
          position={[s.z.latLng.lat, s.z.latLng.lng]}
          icon={numberedIcon(s.idx, s.z.color)}
          eventHandlers={{ click: () => setSelected(s.item.id) }}
        >
          <Popup>
            <b>{s.idx}. {s.item.title}</b><br />
            {s.item.startTime}–{s.item.endTime} · {s.z.name}
            {s.item.warning && <div style={{ color: '#c0392b' }}>⚠ {s.item.warning}</div>}
          </Popup>
        </Marker>
      ))}
      <FlyToSelected />
    </MapContainer>
  )
}
```

- [ ] **Step 2: Manual verify**

Run: `npm run dev`. Open the Vite URL. Expect OSM tiles + grey building footprints + path lines over VinWonders. (No markers yet until an itinerary exists — verified end-to-end in Task 14.) Stop dev.

- [ ] **Step 3: Commit**

```bash
git add src/components/ParkMap.tsx
git commit -m "feat: ParkMap with geojson base layer + numbered route"
```

---

## Task 11: Timeline (dnd-kit, lock/delete, warnings)

**Files:**
- Modify: `src/components/Timeline.tsx`

- [ ] **Step 1: Implement Timeline**

Replace `src/components/Timeline.tsx`:
```tsx
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '../store/useStore'
import { ZONES_BY_ID } from '../data/zones'
import type { ItineraryItem } from '../types'

function Card({ item }: { item: ItineraryItem }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const removeItem = useStore((s) => s.removeItem)
  const toggleLock = useStore((s) => s.toggleLock)
  const setSelected = useStore((s) => s.setSelected)
  const color = item.zoneId ? ZONES_BY_ID[item.zoneId]?.color ?? '#888' : '#888'
  const style = { transform: CSS.Transform.toString(transform), transition, borderTopColor: color }
  return (
    <div ref={setNodeRef} style={style}
      onClick={() => setSelected(item.id)}
      className="min-w-[150px] bg-white rounded-lg border-t-4 shadow px-3 py-2 text-sm cursor-pointer select-none">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-slate-500">{item.startTime}–{item.endTime}</span>
        <span {...attributes} {...listeners} className="cursor-grab text-slate-400">⠿</span>
      </div>
      <div className="font-semibold leading-tight my-1">{item.title}</div>
      {item.warning && <div className="text-xs text-red-600">⚠ {item.warning}</div>}
      <div className="flex gap-2 mt-1">
        <button onClick={(e) => { e.stopPropagation(); toggleLock(item.id) }}
          className="text-xs px-1.5 py-0.5 rounded bg-slate-100">{item.locked ? '🔒' : '🔓'}</button>
        <button onClick={(e) => { e.stopPropagation(); removeItem(item.id) }}
          className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600">Xoá</button>
      </div>
    </div>
  )
}

export function Timeline() {
  const itinerary = useStore((s) => s.itinerary)
  const reorder = useStore((s) => s.reorder)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  if (itinerary.length === 0)
    return <div className="h-full flex items-center justify-center text-slate-400 text-sm">
      Lịch trình sẽ hiện ở đây sau khi AI lập lịch.</div>

  return (
    <div className="h-full p-3 overflow-x-auto">
      <div className="text-xs font-semibold text-slate-500 mb-2">📋 LỊCH TRÌNH (kéo để sắp lại)</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => { if (over && active.id !== over.id) reorder(String(active.id), String(over.id)) }}>
        <SortableContext items={itinerary.map((i) => i.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-3 items-start">
            {itinerary.map((it) => <Card key={it.id} item={it} />)}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
```
> Note: `arrayMove` import is available if you prefer index-based reordering; current `reorder` in the store handles it by id.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Timeline.tsx
git commit -m "feat: draggable Timeline with lock/delete + warnings"
```

---

## Task 12: ChatPanel + SuggestionCards

**Files:**
- Modify: `src/components/ChatPanel.tsx`
- Create: `src/components/SuggestionCards.tsx`

ChatPanel sends the conversation to `/api/plan`, applies the response: `clarify` → just show text; `plan`/`edit` → turn `chosenIds` into `PlanEntry[]`, recompute, and surface a SuggestionCards summary.

- [ ] **Step 1: SuggestionCards**

Create `src/components/SuggestionCards.tsx`:
```tsx
import { ATTRACTIONS_BY_ID } from '../data/attractions'
import { ZONES_BY_ID } from '../data/zones'

export function SuggestionCards({ ids }: { ids: string[] }) {
  const items = ids.map((id) => ATTRACTIONS_BY_ID[id]).filter(Boolean)
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {items.map((a) => (
        <div key={a.id} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
          <span className="font-semibold">{a.name}</span>
          <span className="text-slate-400"> · {ZONES_BY_ID[a.zoneId].name} · {a.durationMin}p</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: ChatPanel**

Replace `src/components/ChatPanel.tsx`:
```tsx
import { useState } from 'react'
import { useStore } from '../store/useStore'
import { requestPlan } from '../lib/aiClient'
import { SuggestionCards } from './SuggestionCards'
import type { PlanEntry } from '../types'

export function ChatPanel() {
  const [input, setInput] = useState('')
  const { messages, pushMessage, setConstraints, setEntries, entries, itinerary, busy, setBusy } = useStore()

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    pushMessage({ role: 'user', text })
    setBusy(true)

    const summary = itinerary.map((i) => `${i.startTime} ${i.title}`).join(', ')
    const history = [...messages, { role: 'user' as const, text }]
    try {
      const r = await requestPlan(history, summary)
      if (r.constraints) setConstraints(r.constraints)
      if (r.action !== 'clarify' && r.chosenIds?.length) {
        const newEntries: PlanEntry[] = r.chosenIds.map((id) => ({ kind: 'attraction', refId: id }))
        // insert meals roughly mid-day (engine times them in sequence)
        for (const meal of r.constraints?.meals ?? []) {
          const at = Math.floor(newEntries.length / 2)
          newEntries.splice(at, 0, { kind: 'meal', meal, durationMin: 45 })
        }
        // 'edit' merges with existing; 'plan' replaces
        setEntries(r.action === 'edit' ? [...entries, ...newEntries] : newEntries)
      }
      pushMessage({ role: 'assistant', text: r.clarifyQuestion ? `${r.assistantText}\n${r.clarifyQuestion}` : r.assistantText })
      ;(window as any).__lastIds = r.chosenIds ?? []
    } catch {
      pushMessage({ role: 'assistant', text: 'Có lỗi kết nối, bạn thử lại nhé.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-slate-400">
            Ví dụ: “Đoàn 4 người có bé 6 tuổi, đến 9h về 15h, thích cảm giác mạnh vừa phải và muốn xem show, ăn trưa ~12h.”
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <div className={`inline-block rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
              m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>{m.text}</div>
            {m.role === 'assistant' && i === messages.length - 1 &&
              <SuggestionCards ids={(window as any).__lastIds ?? []} />}
          </div>
        ))}
        {busy && <div className="text-sm text-slate-400">AI đang lập lịch…</div>}
      </div>
      <div className="p-3 border-t border-slate-200 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Nhập yêu cầu…"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <button onClick={send} disabled={busy}
          className="bg-blue-600 text-white rounded-lg px-4 text-sm disabled:opacity-50">Gửi</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ChatPanel.tsx src/components/SuggestionCards.tsx
git commit -m "feat: ChatPanel calls /api/plan, applies plan/edit/clarify"
```

---

## Task 13: Calibration mode (set real coords)

**Files:**
- Create: `src/components/Calibration.tsx`
- Modify: `src/components/AppShell.tsx` (add a toggle), `src/store/useStore.ts` (coord overrides)

Lets you click a zone in a list, then click the map to set its real coordinate; overrides persist in localStorage and feed back into `ZONES_BY_ID` lookups via the store.

- [ ] **Step 1: Add coord overrides to the store**

In `src/store/useStore.ts`, add to the `State` type and store:
```ts
// add to State type:
  coordOverrides: Record<string, { lat: number; lng: number }>
  calibrating: boolean
  calibratingZoneId: string | null
  setCoord: (zoneId: string, lat: number, lng: number) => void
  setCalibrating: (b: boolean) => void
  setCalibratingZone: (id: string | null) => void
```
And in the store body (after `busy: false,`):
```ts
  coordOverrides: JSON.parse(localStorage.getItem('coordOverrides') || '{}'),
  calibrating: false,
  calibratingZoneId: null,
  setCoord: (zoneId, lat, lng) => set((s) => {
    const next = { ...s.coordOverrides, [zoneId]: { lat, lng } }
    localStorage.setItem('coordOverrides', JSON.stringify(next))
    return { coordOverrides: next }
  }),
  setCalibrating: (b) => set({ calibrating: b }),
  setCalibratingZone: (id) => set({ calibratingZoneId: id }),
```
Then make `travel` and map markers use overrides. Add a helper exported from the store:
```ts
export function zoneLatLng(zoneId: string | null): { lat: number; lng: number } | null {
  if (!zoneId) return null
  const o = useStore.getState().coordOverrides[zoneId]
  const z = ZONES_BY_ID[zoneId]
  return o ?? (z ? z.latLng : null)
}
```
Update the internal `travel` to use `zoneLatLng` instead of `ZONES_BY_ID[...].latLng`.

- [ ] **Step 2: Calibration component**

Create `src/components/Calibration.tsx`:
```tsx
import { useMapEvents } from 'react-leaflet'
import { useStore } from '../store/useStore'
import { ZONES } from '../data/zones'

export function CalibrationClickLayer() {
  const calibrating = useStore((s) => s.calibrating)
  const zoneId = useStore((s) => s.calibratingZoneId)
  const setCoord = useStore((s) => s.setCoord)
  useMapEvents({
    click(e) {
      if (calibrating && zoneId) setCoord(zoneId, e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export function CalibrationPanel() {
  const { calibrating, setCalibrating, calibratingZoneId, setCalibratingZone, coordOverrides } = useStore()
  return (
    <div className="absolute z-[1000] top-2 right-2 bg-white/95 rounded-lg shadow p-2 text-xs w-56">
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={calibrating} onChange={(e) => setCalibrating(e.target.checked)} />
        Chế độ chỉnh toạ độ
      </label>
      {calibrating && (
        <div className="mt-2 space-y-1">
          <div className="text-slate-500">Chọn khu rồi click lên bản đồ:</div>
          {ZONES.map((z) => (
            <button key={z.id} onClick={() => setCalibratingZone(z.id)}
              className={`block w-full text-left px-2 py-1 rounded ${calibratingZoneId === z.id ? 'bg-blue-100' : 'bg-slate-50'}`}>
              <span style={{ color: z.color }}>●</span> {z.name}
              {coordOverrides[z.id] && <span className="text-green-600"> ✓</span>}
            </button>
          ))}
          <div className="text-slate-400 mt-1">Toạ độ lưu tự động (localStorage).</div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Mount in ParkMap + AppShell**

In `src/components/ParkMap.tsx`: import and render `<CalibrationClickLayer />` inside `<MapContainer>`, and render `<CalibrationPanel />` next to the map (wrap MapContainer in a `relative` div). Use `zoneLatLng` from the store for marker/line positions so overrides take effect.

- [ ] **Step 4: Manual verify**

Run `npm run dev`, tick "Chế độ chỉnh toạ độ", click a zone, click on the map → reload page → coordinate persists (green ✓). Stop dev.

- [ ] **Step 5: Commit**

```bash
git add src/components/Calibration.tsx src/components/ParkMap.tsx src/store/useStore.ts
git commit -m "feat: calibration mode to set + persist real zone coords"
```

---

## Task 14: End-to-end wiring + four-paths demo

**Files:**
- No new files; verify the four SPEC paths work together.

- [ ] **Step 1: Run full app**

Put a real key in `.env`. Run: `npm run dev` (starts both web + api). Open the web URL.

- [ ] **Step 2: Happy path**

Type: “Đoàn 4 người có bé 6 tuổi, đến 9h về 15h, thích nhẹ nhàng và muốn xem show, ăn trưa ~12h.”
Expected: AI replies, timeline fills with kid-friendly rides + a show, map draws numbered route 1→N. Verify times don’t overlap and have buffers.

- [ ] **Step 3: Low-confidence path**

New session (reload). Type: “Có trò nào vui không?”
Expected: `action=clarify` — AI asks back (e.g. trẻ nhỏ? trong nhà/ngoài trời?). Timeline stays empty.

- [ ] **Step 4: Failure path**

Type a too-tight request: “Mình chỉ rảnh từ 19:00 đến 19:30, chơi tàu lượn Zeus và xem show Once.”
Expected: items carry ⚠ warnings (đóng cửa / không kịp show / vượt giờ về).

- [ ] **Step 5: Correction path**

After a plan exists, click 🔓→🔒 to lock one item, then “Xoá” another (or type “bỏ tàu lượn Zeus đi”).
Expected: timeline recomputes, buffers/times update, map route updates.

- [ ] **Step 6: Write README + commit**

Create `README.md`:
```markdown
# VinWonders AI Scheduler
Trợ lý AI lập lịch vui chơi VinWonders Phú Quốc (React + Gemini + Leaflet).

## Setup
1. `npm install`
2. Copy `.env.example` → `.env`, điền `GEMINI_API_KEY`.
3. `npm run dev` (chạy web + api).
4. Mở URL Vite in ra.

## Test
`npm run test`

## Kiến trúc
Gemini (qua proxy `server/`) hiểu ngôn ngữ + chọn trò; `src/engine/scheduleEngine.ts` tính giờ/buffer/cảnh báo; bản đồ Leaflet nạp `public/vinwonder.geojson`.
```
Run: `npm run test` → all green. Then:
```bash
git add -A
git commit -m "docs: add README; verify four-paths end-to-end"
```

---

## Notes for the implementer

- **Gemini model name** is configurable via `GEMINI_MODEL`. If `gemini-2.0-flash` is unavailable on your key, try `gemini-2.5-flash` or `gemini-1.5-flash`.
- **Coords are seeds.** The map base layer (geojson) is real; the 6 zone marker positions are approximate until you run Calibration (Task 13). Demo still works without calibration.
- **Travel v2 (optional, out of scope):** build a graph from `footway`/`service` LineStrings in the geojson and run Dijkstra for real walking paths; replace `walkMinutes` with the graph distance.
- **No silent caps:** the dataset has ~22 attractions; if you add more, keep `dataset.test.ts` green.
