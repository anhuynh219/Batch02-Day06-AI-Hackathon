# Cold-start Survey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Một khảo sát onboarding ~6 câu tap-nhanh học hành vi + tính cách người dùng, rồi pre-fill constraints, sinh lịch nháp qua AI, và lưu persona bơm vào system prompt.

**Architecture:** Hướng A (Lai). Lớp logic thuần `src/survey/profileMapping.ts` biến `SurveyProfile` → `UserConstraints` + persona + seed prompt. Luồng AI hiện có được tách thành store action `runPlan(text)` để cả ChatPanel lẫn Survey tái dùng. Persona truyền qua `/api/plan` và nối vào `systemInstruction`.

**Tech Stack:** React 18 + TypeScript + Zustand + Tailwind; Vitest + @testing-library/react (jsdom); Express + @google/genai.

**Quyết định triển khai (tinh giản so với spec):** v1 chỉ làm 3 preset giờ (full/morning/afternoon); bỏ "Tự chọn giờ" (time-picker) — YAGNI, để sau. `arrivalTime/departureTime` suy ra từ `timeRange`, không lưu trong profile.

---

## File Structure

| File | Trách nhiệm |
|------|-------------|
| `src/survey/types.ts` | Type `SurveyProfile` (mới) |
| `src/survey/questions.ts` | Dữ liệu 6 câu hỏi + type `Question`/`QuestionOption` (mới) |
| `src/survey/profileMapping.ts` | Logic thuần: `toConstraints`, `toPersona`, `toSeedPrompt` (mới) |
| `src/survey/profileMapping.test.ts` | Unit test mapping (mới) |
| `src/components/Survey/QuestionStep.tsx` | Render 1 câu (chips đơn/nhiều) (mới) |
| `src/components/Survey/QuestionStep.test.tsx` | Component test (mới) |
| `src/components/Survey/SurveyModal.tsx` | Khung modal, điều hướng bước, Skip/Back/Finish (mới) |
| `src/components/Survey/SurveyModal.test.tsx` | Component test điều hướng + finish (mới) |
| `src/store/useStore.ts` | Thêm state survey + `runPlan`, `completeSurvey`, `skipSurvey`, `openSurvey` (sửa) |
| `src/lib/aiClient.ts` | Thêm tham số `persona` (sửa) |
| `server/gemini.ts` | `composeSystemInstruction` + nhận `persona` (sửa) |
| `server/index.ts` | Đọc `persona`, truyền xuống (sửa) |
| `src/components/ChatPanel.tsx` | `send` ủy quyền cho `runPlan` (sửa) |
| `src/components/AppShell.tsx` | Gắn `SurveyModal` + nút "✨ Cá nhân hoá" (sửa) |

Mọi lệnh chạy từ `codebase/vinwonders-scheduler/`.

---

## Task 1: SurveyProfile type + dữ liệu câu hỏi

**Files:**
- Create: `src/survey/types.ts`
- Create: `src/survey/questions.ts`
- Test: `src/survey/questions.test.ts`

- [ ] **Step 1: Viết test thất bại**

```ts
// src/survey/questions.test.ts
import { describe, it, expect } from 'vitest'
import { QUESTIONS } from './questions'

describe('QUESTIONS', () => {
  it('has 6 questions with stable ids', () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual(['time', 'group', 'intensity', 'interests', 'pace', 'avoid'])
  })
  it('every option has value/label/icon and non-empty options', () => {
    for (const q of QUESTIONS) {
      expect(q.options.length).toBeGreaterThan(0)
      for (const o of q.options) {
        expect(o.value).toBeTruthy()
        expect(o.label).toBeTruthy()
        expect(o.icon).toBeTruthy()
      }
    }
  })
  it('interests and avoid are multi-select; others are single', () => {
    const multi = QUESTIONS.filter((q) => q.multi).map((q) => q.id)
    expect(multi.sort()).toEqual(['avoid', 'interests'])
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/survey/questions.test.ts`
Expected: FAIL — "Cannot find module './questions'".

- [ ] **Step 3: Tạo type**

```ts
// src/survey/types.ts
export type TimeRange = 'full' | 'morning' | 'afternoon'
export type GroupType = 'solo' | 'couple' | 'friends' | 'family'
export type IntensityPref = 'high' | 'balanced' | 'gentle' | 'kids'
export type Interest = 'thrill' | 'water' | 'aquarium' | 'show' | 'indoor' | 'adventure'
export type Pace = 'relaxed' | 'balanced' | 'packed'
export type AvoidKey = 'heights' | 'wet' | 'queue' | 'vegetarian' | 'allergy'

export type SurveyProfile = {
  timeRange: TimeRange
  groupType: GroupType
  intensity: IntensityPref
  interests: Interest[]
  pace: Pace
  avoid: AvoidKey[]
  completedAt: string
}
```

- [ ] **Step 4: Tạo dữ liệu câu hỏi**

```ts
// src/survey/questions.ts
export type QuestionOption = { value: string; label: string; icon: string }
export type Question = {
  id: 'time' | 'group' | 'intensity' | 'interests' | 'pace' | 'avoid'
  title: string
  multi: boolean
  options: QuestionOption[]
}

export const QUESTIONS: Question[] = [
  {
    id: 'time', title: 'Bạn dự định chơi trong khung giờ nào?', multi: false,
    options: [
      { value: 'full', label: 'Cả ngày (9:00–19:00)', icon: '🌅' },
      { value: 'morning', label: 'Buổi sáng (9:00–13:00)', icon: '☀️' },
      { value: 'afternoon', label: 'Chiều–tối (13:00–19:30)', icon: '🌇' },
    ],
  },
  {
    id: 'group', title: 'Bạn đi cùng ai?', multi: false,
    options: [
      { value: 'solo', label: 'Một mình', icon: '🧍' },
      { value: 'couple', label: 'Cặp đôi', icon: '💑' },
      { value: 'friends', label: 'Nhóm bạn', icon: '👥' },
      { value: 'family', label: 'Gia đình có trẻ nhỏ', icon: '👨‍👩‍👧' },
    ],
  },
  {
    id: 'intensity', title: 'Bạn thích cảm giác thế nào?', multi: false,
    options: [
      { value: 'high', label: 'Mạo hiểm tối đa', icon: '🎢' },
      { value: 'balanced', label: 'Cân bằng', icon: '⚖️' },
      { value: 'gentle', label: 'Nhẹ nhàng thư giãn', icon: '🌴' },
      { value: 'kids', label: 'Hợp trẻ nhỏ', icon: '🧸' },
    ],
  },
  {
    id: 'interests', title: 'Bạn mê kiểu trải nghiệm nào? (chọn nhiều)', multi: true,
    options: [
      { value: 'thrill', label: 'Tàu lượn mạnh', icon: '🎢' },
      { value: 'water', label: 'Công viên nước', icon: '🌊' },
      { value: 'aquarium', label: 'Thuỷ cung', icon: '🐠' },
      { value: 'show', label: 'Show & sống ảo', icon: '🎆' },
      { value: 'indoor', label: 'Cổ tích / trong nhà', icon: '🏰' },
      { value: 'adventure', label: 'Khám phá phiêu lưu', icon: '🗺️' },
    ],
  },
  {
    id: 'pace', title: 'Nhịp độ bạn muốn?', multi: false,
    options: [
      { value: 'relaxed', label: 'Thong thả, nghỉ nhiều', icon: '🐢' },
      { value: 'balanced', label: 'Cân bằng', icon: '⚖️' },
      { value: 'packed', label: 'Chơi hết mình', icon: '🚀' },
    ],
  },
  {
    id: 'avoid', title: 'Có điều gì cần tránh không? (có thể bỏ trống)', multi: true,
    options: [
      { value: 'heights', label: 'Sợ độ cao', icon: '😱' },
      { value: 'wet', label: 'Không thích bị ướt', icon: '💧' },
      { value: 'queue', label: 'Ngại xếp hàng lâu', icon: '⏳' },
      { value: 'vegetarian', label: 'Ăn chay', icon: '🥗' },
      { value: 'allergy', label: 'Dị ứng / đồ ăn riêng', icon: '⚠️' },
    ],
  },
]
```

- [ ] **Step 5: Chạy test, xác nhận PASS**

Run: `npx vitest run src/survey/questions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/survey/types.ts src/survey/questions.ts src/survey/questions.test.ts
git commit -m "feat(survey): add SurveyProfile type and question data"
```

---

## Task 2: profileMapping — toConstraints

**Files:**
- Create: `src/survey/profileMapping.ts`
- Test: `src/survey/profileMapping.test.ts`

- [ ] **Step 1: Viết test thất bại**

```ts
// src/survey/profileMapping.test.ts
import { describe, it, expect } from 'vitest'
import { toConstraints } from './profileMapping'
import type { SurveyProfile } from './types'

const base: SurveyProfile = {
  timeRange: 'full', groupType: 'couple', intensity: 'high',
  interests: ['thrill', 'water'], pace: 'relaxed', avoid: ['heights'], completedAt: '2026-06-04T00:00:00Z',
}

describe('toConstraints', () => {
  it('maps full day to 09:00–19:00 with lunch and dinner', () => {
    const c = toConstraints(base)
    expect(c.arrivalTime).toBe('09:00')
    expect(c.departureTime).toBe('19:00')
    expect(c.meals).toEqual([{ type: 'lunch', around: '12:00' }, { type: 'dinner', around: '18:30' }])
  })
  it('maps morning to a single lunch, afternoon to a single dinner', () => {
    expect(toConstraints({ ...base, timeRange: 'morning' }).meals).toEqual([{ type: 'lunch', around: '12:00' }])
    expect(toConstraints({ ...base, timeRange: 'afternoon' }).meals).toEqual([{ type: 'dinner', around: '18:30' }])
  })
  it('maps group type to size + hasKids', () => {
    expect(toConstraints({ ...base, groupType: 'solo' })).toMatchObject({ groupSize: 1, hasKids: false })
    expect(toConstraints({ ...base, groupType: 'family' })).toMatchObject({ groupSize: 4, hasKids: true })
  })
  it('builds prefs from intensity + interests', () => {
    const c = toConstraints(base)
    expect(c.prefs).toContain('thích cảm giác mạnh')
    expect(c.prefs).toContain('tàu lượn cảm giác mạnh')
    expect(c.prefs).toContain('công viên nước')
  })
  it('maps only attraction-relevant avoid keys (heights), not dietary', () => {
    const c = toConstraints({ ...base, avoid: ['heights', 'vegetarian'] })
    expect(c.avoid).toEqual(['trò chơi trên cao / độ cao'])
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/survey/profileMapping.test.ts`
Expected: FAIL — "Cannot find module './profileMapping'".

- [ ] **Step 3: Triển khai mapping + bảng nhãn dùng chung**

```ts
// src/survey/profileMapping.ts
import type { Meal, UserConstraints } from '../types'
import type { SurveyProfile } from './types'

export const TIME_RANGES: Record<SurveyProfile['timeRange'], { arrivalTime: string; departureTime: string }> = {
  full: { arrivalTime: '09:00', departureTime: '19:00' },
  morning: { arrivalTime: '09:00', departureTime: '13:00' },
  afternoon: { arrivalTime: '13:00', departureTime: '19:30' },
}

const GROUP: Record<SurveyProfile['groupType'], { groupSize: number; hasKids: boolean }> = {
  solo: { groupSize: 1, hasKids: false },
  couple: { groupSize: 2, hasKids: false },
  friends: { groupSize: 4, hasKids: false },
  family: { groupSize: 4, hasKids: true },
}

export const GROUP_LABEL: Record<SurveyProfile['groupType'], string> = {
  solo: 'một mình', couple: 'cặp đôi', friends: 'nhóm bạn', family: 'gia đình',
}
export const INTENSITY_PREF: Record<SurveyProfile['intensity'], string> = {
  high: 'thích cảm giác mạnh', balanced: 'cân bằng cảm giác mạnh và nhẹ nhàng',
  gentle: 'thích nhẹ nhàng thư giãn', kids: 'ưu tiên trò hợp trẻ nhỏ',
}
export const INTEREST_PREF: Record<string, string> = {
  thrill: 'tàu lượn cảm giác mạnh', water: 'công viên nước', aquarium: 'thuỷ cung',
  show: 'show diễn và chụp ảnh', indoor: 'trò trong nhà / cổ tích', adventure: 'khám phá phiêu lưu',
}
export const PACE_LABEL: Record<SurveyProfile['pace'], string> = {
  relaxed: 'thong thả', balanced: 'cân bằng', packed: 'chơi hết mình',
}
export const AVOID_ATTRACTION: Record<string, string> = {
  heights: 'trò chơi trên cao / độ cao', wet: 'trò chơi bị ướt', queue: 'trò phải xếp hàng quá lâu',
}
export const DIET_LABEL: Record<string, string> = {
  vegetarian: 'ăn chay', allergy: 'có dị ứng thực phẩm',
}

function toMin(t: string): number { const [h, m] = t.split(':').map(Number); return h * 60 + m }

function mealsForWindow(arrival: string, departure: string): Meal[] {
  const a = toMin(arrival), d = toMin(departure)
  const meals: Meal[] = []
  if (a <= 12 * 60 && d >= 13 * 60) meals.push({ type: 'lunch', around: '12:00' })
  if (a <= 18 * 60 && d >= 18 * 60 + 30) meals.push({ type: 'dinner', around: '18:30' })
  return meals
}

export function toConstraints(p: SurveyProfile): Partial<UserConstraints> {
  const { arrivalTime, departureTime } = TIME_RANGES[p.timeRange]
  const { groupSize, hasKids } = GROUP[p.groupType]
  const prefs = [INTENSITY_PREF[p.intensity], ...p.interests.map((i) => INTEREST_PREF[i])].filter(Boolean)
  const avoid = p.avoid.map((a) => AVOID_ATTRACTION[a]).filter(Boolean)
  return { arrivalTime, departureTime, groupSize, hasKids, prefs, avoid, meals: mealsForWindow(arrivalTime, departureTime) }
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx vitest run src/survey/profileMapping.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/survey/profileMapping.ts src/survey/profileMapping.test.ts
git commit -m "feat(survey): map SurveyProfile to UserConstraints"
```

---

## Task 3: profileMapping — toPersona + toSeedPrompt

**Files:**
- Modify: `src/survey/profileMapping.ts`
- Modify: `src/survey/profileMapping.test.ts`

- [ ] **Step 1: Thêm test thất bại**

```ts
// append to src/survey/profileMapping.test.ts
import { toPersona, toSeedPrompt } from './profileMapping'

describe('toPersona', () => {
  it('summarises group, intensity, interests, pace and avoid', () => {
    const s = toPersona(base)
    expect(s).toContain('cặp đôi')
    expect(s).toContain('thích cảm giác mạnh')
    expect(s).toContain('công viên nước')
    expect(s).toContain('thong thả')
    expect(s).toContain('tránh')
    expect(s.endsWith('.')).toBe(true)
  })
})

describe('toSeedPrompt', () => {
  it('produces a natural request with the time window and an ask to plan', () => {
    const s = toSeedPrompt(base)
    expect(s).toContain('09:00')
    expect(s).toContain('19:00')
    expect(s.toLowerCase()).toContain('lên lịch')
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/survey/profileMapping.test.ts`
Expected: FAIL — "toPersona is not a function".

- [ ] **Step 3: Triển khai (thêm vào cuối `profileMapping.ts`)**

```ts
export function toPersona(p: SurveyProfile): string {
  const parts: string[] = [
    GROUP_LABEL[p.groupType],
    p.groupType === 'family' ? 'có trẻ nhỏ' : 'không trẻ nhỏ',
    INTENSITY_PREF[p.intensity],
  ]
  const interests = p.interests.map((i) => INTEREST_PREF[i]).filter(Boolean)
  if (interests.length) parts.push('thích ' + interests.join(', '))
  parts.push('nhịp độ ' + PACE_LABEL[p.pace])
  const av = p.avoid.map((a) => AVOID_ATTRACTION[a]).filter(Boolean)
  if (av.length) parts.push('tránh ' + av.join(', '))
  const diet = p.avoid.map((a) => DIET_LABEL[a]).filter(Boolean)
  if (diet.length) parts.push(diet.join(', '))
  return parts.join(', ') + '.'
}

export function toSeedPrompt(p: SurveyProfile): string {
  const { arrivalTime, departureTime } = TIME_RANGES[p.timeRange]
  const interests = p.interests.map((i) => INTEREST_PREF[i]).filter(Boolean).join(', ')
  const av = p.avoid.map((a) => AVOID_ATTRACTION[a]).filter(Boolean)
  const diet = p.avoid.map((a) => DIET_LABEL[a]).filter(Boolean)
  let s = `Mình là ${GROUP_LABEL[p.groupType]}${p.groupType === 'family' ? ' (có trẻ nhỏ)' : ''}, chơi từ ${arrivalTime} đến ${departureTime}. ${INTENSITY_PREF[p.intensity]}`
  if (interests) s += `, đặc biệt thích ${interests}`
  s += `. Nhịp độ ${PACE_LABEL[p.pace]}.`
  if (av.length) s += ` Tránh giúp mình ${av.join(', ')}.`
  if (diet.length) s += ` Lưu ý ăn uống: ${diet.join(', ')}.`
  s += ' Hãy lên lịch trình phù hợp.'
  return s
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx vitest run src/survey/profileMapping.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/survey/profileMapping.ts src/survey/profileMapping.test.ts
git commit -m "feat(survey): generate persona and seed prompt from profile"
```

---

## Task 4: Server — nối persona vào system prompt

**Files:**
- Modify: `server/gemini.ts`
- Test: `server/gemini.test.ts`

- [ ] **Step 1: Viết test thất bại cho hàm thuần**

```ts
// server/gemini.test.ts
import { describe, it, expect } from 'vitest'
import { composeSystemInstruction } from './gemini'

describe('composeSystemInstruction', () => {
  it('inserts a persona block between template and menu', () => {
    const out = composeSystemInstruction('TEMPLATE', 'Khách: cặp đôi.', 'MENU')
    expect(out).toBe('TEMPLATE\n\n# Hồ sơ khách\nKhách: cặp đôi.\nMENU')
  })
  it('omits the persona block when persona is empty/whitespace', () => {
    expect(composeSystemInstruction('TEMPLATE', '', 'MENU')).toBe('TEMPLATEMENU')
    expect(composeSystemInstruction('TEMPLATE', '   ', 'MENU')).toBe('TEMPLATEMENU')
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run server/gemini.test.ts`
Expected: FAIL — "composeSystemInstruction is not exported".

- [ ] **Step 3: Sửa `server/gemini.ts`**

Thay hàm `systemPrompt` và export hàm thuần; thêm `persona` vào `askGemini`.

```ts
// replace the existing systemPrompt function with:
export function composeSystemInstruction(template: string, persona: string, menu: string): string {
  const block = persona.trim() ? `\n\n# Hồ sơ khách\n${persona.trim()}\n` : ''
  return `${template}${block}${menu}`
}

function systemPrompt(menu: string, persona: string): string {
  const filePath = path.join(__dirname, 'SYSTEM_PROMPT.md')
  const template = fs.readFileSync(filePath, 'utf8')
  return composeSystemInstruction(template, persona, menu)
}
```

```ts
// update askGemini signature + the systemInstruction call:
export async function askGemini(opts: {
  messages: { role: 'user' | 'assistant'; text: string }[]
  itinerarySummary: string
  menu: string
  persona?: string
}): Promise<PlanResponse> {
  // ...unchanged contents building...
  const res = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt(opts.menu, opts.persona ?? ''),
      responseMimeType: 'application/json',
      responseSchema,
    },
  })
  // ...unchanged...
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx vitest run server/gemini.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/gemini.ts server/gemini.test.ts
git commit -m "feat(server): inject persona into Gemini system instruction"
```

---

## Task 5: Plumbing persona qua API (client + server route)

**Files:**
- Modify: `src/lib/aiClient.ts`
- Modify: `server/index.ts:23-31` (handler `/api/plan`)

- [ ] **Step 1: Thêm tham số `persona` vào `requestPlan`**

```ts
// src/lib/aiClient.ts
import type { PlanResponse } from '../types'

export async function requestPlan(
  messages: { role: 'user' | 'assistant'; text: string }[],
  itinerarySummary: string,
  persona = '',
): Promise<PlanResponse> {
  const res = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, itinerarySummary, persona }),
  })
  if (!res.ok) throw new Error(`/api/plan failed: ${res.status}`)
  return res.json()
}
```

- [ ] **Step 2: Đọc `persona` trong route và truyền xuống `askGemini`**

```ts
// server/index.ts — inside app.post('/api/plan', ...)
const { messages = [], itinerarySummary = '', persona = '' } = req.body ?? {}
// ...
const r = await askGemini({ messages, itinerarySummary, menu, persona })
```

- [ ] **Step 3: Build kiểm tra type**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 4: Commit**

```bash
git add src/lib/aiClient.ts server/index.ts
git commit -m "feat: pass persona from client through /api/plan"
```

---

## Task 6: Store — runPlan + state survey + actions

**Files:**
- Modify: `src/store/useStore.ts`
- Modify: `src/components/ChatPanel.tsx`
- Test: `src/store/survey.test.ts`

- [ ] **Step 1: Viết test thất bại (mock aiClient)**

```ts
// src/store/survey.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/aiClient', () => ({
  requestPlan: vi.fn(async () => ({
    action: 'plan', assistantText: 'Đã xếp lịch!', chosenIds: ['zeus'],
    constraints: { arrivalTime: '09:00', departureTime: '19:00', meals: [] },
  })),
}))

import { useStore } from './useStore'
import { requestPlan } from '../lib/aiClient'
import type { SurveyProfile } from '../survey/types'

const profile: SurveyProfile = {
  timeRange: 'full', groupType: 'couple', intensity: 'high',
  interests: ['thrill'], pace: 'balanced', avoid: [], completedAt: '2026-06-04T00:00:00Z',
}

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ messages: [], entries: [], itinerary: [], busy: false, profile: null, persona: '', surveyOpen: false })
})

describe('completeSurvey', () => {
  it('stores profile + persona, pre-fills constraints, and runs a plan with the persona', async () => {
    await useStore.getState().completeSurvey(profile)
    const s = useStore.getState()
    expect(s.profile).toEqual(profile)
    expect(s.persona).toContain('cặp đôi')
    expect(s.surveyOpen).toBe(false)
    expect(localStorage.getItem('surveyDone')).toBe('1')
    // requestPlan called with persona as 3rd arg
    expect(requestPlan).toHaveBeenCalled()
    const personaArg = (requestPlan as any).mock.calls[0][2]
    expect(personaArg).toContain('cặp đôi')
    expect(s.entries.some((e: any) => e.refId === 'zeus')).toBe(true)
  })
})

describe('skipSurvey', () => {
  it('marks done and closes without running a plan', () => {
    useStore.getState().skipSurvey()
    expect(useStore.getState().surveyOpen).toBe(false)
    expect(localStorage.getItem('surveyDone')).toBe('1')
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/store/survey.test.ts`
Expected: FAIL — `completeSurvey is not a function`.

- [ ] **Step 3: Sửa `useStore.ts` — thêm import**

```ts
// add near other imports
import { requestPlan } from '../lib/aiClient'
import type { SurveyProfile } from '../survey/types'
import { toConstraints, toPersona, toSeedPrompt } from '../survey/profileMapping'
import type { PlanEntry } from '../types'
```

- [ ] **Step 4: Thêm field vào type `State`**

```ts
// inside `type State = { ... }`, add:
  profile: SurveyProfile | null
  persona: string
  surveyOpen: boolean
  surveyDone: boolean
  runPlan: (text: string) => Promise<void>
  completeSurvey: (profile: SurveyProfile) => Promise<void>
  skipSurvey: () => void
  openSurvey: () => void
```

- [ ] **Step 5: Thêm giá trị khởi tạo + actions trong `create<State>(...)`**

```ts
// initial state (near messages: [], etc.)
  profile: JSON.parse(localStorage.getItem('surveyProfile') || 'null'),
  persona: (() => { const p = JSON.parse(localStorage.getItem('surveyProfile') || 'null'); return p ? toPersona(p) : '' })(),
  surveyOpen: !localStorage.getItem('surveyDone'),
  surveyDone: !!localStorage.getItem('surveyDone'),

  // actions
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
        const newEntries: PlanEntry[] = (r.chosenIds ?? []).map((id) => ({ kind: 'attraction', refId: id }))
        for (const meal of r.constraints?.meals ?? []) {
          const at = Math.floor(newEntries.length / 2)
          newEntries.splice(at, 0, { kind: 'meal', meal, durationMin: 45 })
        }
        get().setEntries(newEntries)
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
```

> Note: `resetConstraints` đã tồn tại trong store (thêm từ nhánh vuminhduy). Nếu chưa có, thêm: `resetConstraints: () => set({ constraints: DEFAULT_CONSTRAINTS }),` và khai báo trong `State`.

- [ ] **Step 6: Chạy test, xác nhận PASS**

Run: `npx vitest run src/store/survey.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Refactor `ChatPanel.tsx` dùng `runPlan` (DRY)**

Thay phần đầu component + hàm `send`:

```ts
// src/components/ChatPanel.tsx — replace the hook line and send()
export function ChatPanel() {
  const [input, setInput] = useState('')
  const { messages, busy, lastSuggestedIds, runPlan } = useStore()

  async function send(text?: string) {
    const value = (text ?? input).trim()
    if (!value || busy) return
    setInput('')
    await runPlan(value)
  }
  // ...rest of JSX unchanged...
```

- [ ] **Step 8: Chạy toàn bộ test + build**

Run: `npx vitest run && npx tsc --noEmit`
Expected: tất cả PASS, không lỗi type (ChatPanel không còn dùng import thừa).

- [ ] **Step 9: Commit**

```bash
git add src/store/useStore.ts src/store/survey.test.ts src/components/ChatPanel.tsx
git commit -m "feat(store): add runPlan + survey actions, reuse in ChatPanel"
```

---

## Task 7: Component QuestionStep

**Files:**
- Create: `src/components/Survey/QuestionStep.tsx`
- Test: `src/components/Survey/QuestionStep.test.tsx`

- [ ] **Step 1: Viết test thất bại**

```tsx
// src/components/Survey/QuestionStep.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuestionStep } from './QuestionStep'
import type { Question } from '../../survey/questions'

const single: Question = {
  id: 'group', title: 'Đi cùng ai?', multi: false,
  options: [{ value: 'solo', label: 'Một mình', icon: '🧍' }, { value: 'couple', label: 'Cặp đôi', icon: '💑' }],
}
const multi: Question = {
  id: 'interests', title: 'Mê gì?', multi: true,
  options: [{ value: 'thrill', label: 'Mạnh', icon: '🎢' }, { value: 'water', label: 'Nước', icon: '🌊' }],
}

describe('QuestionStep', () => {
  it('single-select reports one value', () => {
    const onChange = vi.fn()
    render(<QuestionStep question={single} value={[]} onChange={onChange} />)
    fireEvent.click(screen.getByText('Cặp đôi'))
    expect(onChange).toHaveBeenCalledWith(['couple'])
  })
  it('multi-select toggles values on/off', () => {
    const onChange = vi.fn()
    const { rerender } = render(<QuestionStep question={multi} value={['thrill']} onChange={onChange} />)
    fireEvent.click(screen.getByText('Nước'))
    expect(onChange).toHaveBeenCalledWith(['thrill', 'water'])
    rerender(<QuestionStep question={multi} value={['thrill', 'water']} onChange={onChange} />)
    fireEvent.click(screen.getByText('Mạnh'))
    expect(onChange).toHaveBeenCalledWith(['water'])
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/components/Survey/QuestionStep.test.tsx`
Expected: FAIL — "Cannot find module './QuestionStep'".

- [ ] **Step 3: Triển khai component**

```tsx
// src/components/Survey/QuestionStep.tsx
import type { Question } from '../../survey/questions'

export function QuestionStep({ question, value, onChange }: {
  question: Question
  value: string[]
  onChange: (next: string[]) => void
}) {
  function pick(v: string) {
    if (question.multi) {
      onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
    } else {
      onChange([v])
    }
  }
  return (
    <div>
      <h3 className="font-display text-xl font-semibold text-ink">{question.title}</h3>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {question.options.map((o) => {
          const active = value.includes(o.value)
          return (
            <button key={o.value} type="button" onClick={() => pick(o.value)}
              aria-pressed={active}
              className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left text-[13.5px] font-medium ring-1 transition ${
                active ? 'bg-coral/10 ring-coral text-ink shadow-card' : 'bg-white ring-ink/10 text-ink/80 hover:ring-coral/40 hover:-translate-y-0.5'}`}>
              <span className="text-xl">{o.icon}</span>
              <span className="flex-1">{o.label}</span>
              {active && <span className="text-coral">✓</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx vitest run src/components/Survey/QuestionStep.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Survey/QuestionStep.tsx src/components/Survey/QuestionStep.test.tsx
git commit -m "feat(survey): QuestionStep chip selector component"
```

---

## Task 8: Component SurveyModal

**Files:**
- Create: `src/components/Survey/SurveyModal.tsx`
- Test: `src/components/Survey/SurveyModal.test.tsx`

- [ ] **Step 1: Viết test thất bại**

```tsx
// src/components/Survey/SurveyModal.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const completeSurvey = vi.fn()
const skipSurvey = vi.fn()
vi.mock('../../store/useStore', () => ({
  useStore: (sel: any) => sel({ surveyOpen: true, profile: null, completeSurvey, skipSurvey }),
}))

import { SurveyModal } from './SurveyModal'

beforeEach(() => { completeSurvey.mockClear(); skipSurvey.mockClear() })

describe('SurveyModal', () => {
  it('shows the first question and a skip button', () => {
    render(<SurveyModal />)
    expect(screen.getByText(/khung giờ nào/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /bỏ qua/i })).toBeTruthy()
  })
  it('skip calls skipSurvey', () => {
    render(<SurveyModal />)
    fireEvent.click(screen.getByRole('button', { name: /bỏ qua/i }))
    expect(skipSurvey).toHaveBeenCalled()
  })
  it('walking all 6 questions and finishing calls completeSurvey with a full profile', () => {
    render(<SurveyModal />)
    // Q1 time -> pick first option, then Next each step (single-selects auto-enable Next)
    fireEvent.click(screen.getByText(/Cả ngày/))
    fireEvent.click(screen.getByRole('button', { name: /tiếp/i }))
    fireEvent.click(screen.getByText(/Cặp đôi/))
    fireEvent.click(screen.getByRole('button', { name: /tiếp/i }))
    fireEvent.click(screen.getByText(/Mạo hiểm tối đa/))
    fireEvent.click(screen.getByRole('button', { name: /tiếp/i }))
    fireEvent.click(screen.getByText(/Tàu lượn mạnh/))
    fireEvent.click(screen.getByRole('button', { name: /tiếp/i }))
    fireEvent.click(screen.getByText(/Chơi hết mình/))
    fireEvent.click(screen.getByRole('button', { name: /tiếp/i }))
    // Q6 avoid (multi, optional) -> finish
    fireEvent.click(screen.getByRole('button', { name: /xong/i }))
    expect(completeSurvey).toHaveBeenCalledTimes(1)
    const profile = completeSurvey.mock.calls[0][0]
    expect(profile).toMatchObject({
      timeRange: 'full', groupType: 'couple', intensity: 'high',
      interests: ['thrill'], pace: 'packed', avoid: [],
    })
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx vitest run src/components/Survey/SurveyModal.test.tsx`
Expected: FAIL — "Cannot find module './SurveyModal'".

- [ ] **Step 3: Triển khai component**

```tsx
// src/components/Survey/SurveyModal.tsx
import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { QUESTIONS } from '../../survey/questions'
import type { SurveyProfile } from '../../survey/types'
import { QuestionStep } from './QuestionStep'

type Answers = Record<string, string[]>

function buildProfile(a: Answers): SurveyProfile {
  return {
    timeRange: (a.time?.[0] ?? 'full') as SurveyProfile['timeRange'],
    groupType: (a.group?.[0] ?? 'couple') as SurveyProfile['groupType'],
    intensity: (a.intensity?.[0] ?? 'balanced') as SurveyProfile['intensity'],
    interests: (a.interests ?? []) as SurveyProfile['interests'],
    pace: (a.pace?.[0] ?? 'balanced') as SurveyProfile['pace'],
    avoid: (a.avoid ?? []) as SurveyProfile['avoid'],
    completedAt: new Date().toISOString(),
  }
}

export function SurveyModal() {
  const surveyOpen = useStore((s) => s.surveyOpen)
  const existing = useStore((s) => s.profile)
  const completeSurvey = useStore((s) => s.completeSurvey)
  const skipSurvey = useStore((s) => s.skipSurvey)

  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>(() => existing ? {
    time: [existing.timeRange], group: [existing.groupType], intensity: [existing.intensity],
    interests: existing.interests, pace: [existing.pace], avoid: existing.avoid,
  } : {})

  if (!surveyOpen) return null

  const q = QUESTIONS[step]
  const isLast = step === QUESTIONS.length - 1
  const value = answers[q.id] ?? []
  // single-select questions require a choice to advance; multi (interests/avoid) may be empty
  const canAdvance = q.multi ? true : value.length > 0

  function setValue(next: string[]) { setAnswers((a) => ({ ...a, [q.id]: next })) }
  function next() {
    if (isLast) completeSurvey(buildProfile(answers))
    else setStep((s) => s + 1)
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-[24px] bg-cream shadow-lift ring-1 ring-ink/10 p-6">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Cá nhân hoá · {step + 1}/{QUESTIONS.length}</span>
          <button onClick={skipSurvey} className="text-[12px] text-muted hover:text-ink underline-offset-2 hover:underline">Bỏ qua</button>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-gradient-to-r from-mango to-coral transition-all"
            style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} />
        </div>

        <div className="mt-5">
          <QuestionStep question={q} value={value} onChange={setValue} />
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            className="text-[13px] text-muted disabled:opacity-30 hover:text-ink">← Quay lại</button>
          <button onClick={next} disabled={!canAdvance}
            className="rounded-full bg-gradient-to-br from-coral to-coral-deep text-cream px-5 py-2 text-[13px] font-semibold shadow transition hover:shadow-lift hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0">
            {isLast ? 'Xong ✨' : 'Tiếp →'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

Run: `npx vitest run src/components/Survey/SurveyModal.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Survey/SurveyModal.tsx src/components/Survey/SurveyModal.test.tsx
git commit -m "feat(survey): SurveyModal multi-step onboarding flow"
```

---

## Task 9: Gắn vào AppShell (hiện lần đầu + nút Cá nhân hoá)

**Files:**
- Modify: `src/components/AppShell.tsx`

- [ ] **Step 1: Import + render modal + nút**

Thêm import:

```tsx
import { SurveyModal } from './Survey/SurveyModal'
import { useStore } from '../store/useStore'
```

Trong `AppShell`, lấy action và render. Đặt `<SurveyModal />` ngay trong div gốc (cuối, trước thẻ đóng), và thêm nút vào header (sau khối tiêu đề `<div>...</div>` trong `.flex.items-center.gap-3`):

```tsx
export function AppShell() {
  const openSurvey = useStore((s) => s.openSurvey)
  return (
    <div className="tropic-bg grain relative h-full flex overflow-hidden">
      {/* ...aside... */}
      {/* trong header, sau cụm tiêu đề, thêm nút canh phải: */}
      {/* <button onClick={openSurvey} ...>✨ Cá nhân hoá</button> */}
      {/* ...main... */}
      <SurveyModal />
    </div>
  )
}
```

Nút cụ thể (chèn vào cuối khối `<div className="relative flex items-center gap-3">`, thêm `ml-auto`):

```tsx
<button onClick={openSurvey}
  className="ml-auto self-start rounded-full bg-cream/15 px-3 py-1.5 text-[12px] font-semibold text-cream ring-1 ring-cream/30 backdrop-blur transition hover:bg-cream/25">
  ✨ Cá nhân hoá
</button>
```

- [ ] **Step 2: Build + test toàn bộ**

Run: `npm run build && npx vitest run`
Expected: build sạch; tất cả test PASS (29 cũ + mới của các task trên).

- [ ] **Step 3: Commit**

```bash
git add src/components/AppShell.tsx
git commit -m "feat(survey): mount SurveyModal on first visit + personalise button"
```

---

## Task 10: Kiểm thử thủ công + chốt

**Files:** none (verification)

- [ ] **Step 1: Chạy app**

Run: `npm run dev`
Mở trình duyệt → modal khảo sát hiện **lần đầu**.

- [ ] **Step 2: Kịch bản kiểm thử**

1. Trả lời 6 câu → bấm "Xong ✨" → modal đóng, chat hiện tin seed + lịch nháp xuất hiện trên timeline, bản đồ vẽ tuyến.
2. Reload trang → modal **không** hiện lại (đã lưu `surveyDone`).
3. Bấm "✨ Cá nhân hoá" → modal mở lại, **điền sẵn** câu trả lời cũ.
4. Mở lần đầu (xoá localStorage) → bấm "Bỏ qua" → vào chat trống như cũ; chat thường vẫn hoạt động.

- [ ] **Step 3: Xác nhận build + test cuối**

Run: `npm run build && npx vitest run`
Expected: build sạch; toàn bộ test PASS.

- [ ] **Step 4: Commit (nếu có chỉnh sửa)**

```bash
git add -A
git commit -m "chore(survey): finalise cold-start onboarding"
```

---

## Self-Review Notes (đã kiểm)

- **Spec coverage:** 6 câu hỏi (Task 1), pre-fill constraints (Task 2), persona+seed (Task 3), bơm persona system prompt (Task 4–5), state+luồng sinh lịch (Task 6), UI modal tap-nhanh+Skip (Task 7–8), hiện lần đầu+nút Cá nhân hoá (Task 9). ✔
- **Type consistency:** `requestPlan(messages, summary, persona)` dùng nhất quán ở aiClient (Task 5) và store (Task 6); `composeSystemInstruction(template, persona, menu)` khớp giữa Task 4 và lời gọi. `SurveyProfile` field khớp giữa Task 1, 2, 3, 6, 8.
- **Sai khác có chủ ý:** bỏ "Tự chọn giờ" (custom time-picker) ở v1; `arrivalTime/departureTime` suy ra từ `timeRange` thay vì lưu trong profile — đã ghi ở đầu plan.
- **Phụ thuộc `resetConstraints`:** giả định đã có sẵn trong store (từ merge vuminhduy); Task 6 có ghi chú thêm nếu thiếu.
