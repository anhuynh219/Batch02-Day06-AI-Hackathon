# Time Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the LLM from narrating clock-times (which drift from the real schedule); make the deterministic engine the single source of truth for time and have it emit a one-line time summary that the app appends to each AI reply.

**Architecture:** LLM = pure NLU (extract constraints + pick attraction IDs, no time reasoning). Engine = all time math + a `buildScheduleSummary(itinerary)` one-liner. `runPlan` concatenates the LLM's qualitative text with the engine summary so chat times are always engine-sourced and auto-correct on time changes.

**Tech Stack:** React + TypeScript + Zustand; Vitest; Express + @google/genai (system prompt only).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/engine/scheduleSummary.ts` | **new** — pure `buildScheduleSummary(itinerary)` → one-line VN summary |
| `src/engine/scheduleSummary.test.ts` | **new** — unit tests |
| `src/store/useStore.ts` | append the engine summary to the assistant message in `runPlan` |
| `src/store/runPlanSummary.test.ts` | **new** — verifies the summary is appended |
| `server/SYSTEM_PROMPT.md` | forbid the LLM from stating times; drop the open/close-filter contradiction; remove a broken bullet |

Run all npm/vitest commands from `codebase/vinwonders-scheduler/`. The branch should be a feature branch (NOT main) — create it before Task 1: `git checkout -b feat/time-ownership`.

Reference — `ItineraryItem` (from `src/types.ts`):
```ts
type ItineraryItemType = 'ride' | 'show' | 'meal' | 'break' | 'entrance' | 'return'
type ItineraryItem = {
  id: string; refId: string | null; type: ItineraryItemType; title: string
  zoneId: string | null; startTime: string; endTime: string; locked: boolean; warning?: string
}
```

---

## Task 1: `buildScheduleSummary` (pure engine function)

**Files:**
- Create: `src/engine/scheduleSummary.ts`
- Test: `src/engine/scheduleSummary.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/scheduleSummary.test.ts
import { describe, it, expect } from 'vitest'
import { buildScheduleSummary } from './scheduleSummary'
import type { ItineraryItem } from '../types'

const mk = (p: Partial<ItineraryItem>): ItineraryItem => ({
  id: 'x', refId: null, type: 'ride', title: 't', zoneId: 'z',
  startTime: '09:00', endTime: '09:30', locked: false, ...p,
})

describe('buildScheduleSummary', () => {
  it('returns empty string for an empty itinerary', () => {
    expect(buildScheduleSummary([])).toBe('')
  })

  it('summarises start–end (end at the return leg), counts stops, notes the gate', () => {
    const it: ItineraryItem[] = [
      mk({ type: 'entrance', startTime: '09:00', endTime: '09:10' }),
      mk({ type: 'ride', startTime: '09:20', endTime: '09:50' }),
      mk({ type: 'meal', startTime: '12:00', endTime: '12:45' }),
      mk({ type: 'return', startTime: '17:00', endTime: '17:00' }),
    ]
    expect(buildScheduleSummary(it)).toBe('🕘 09:00–17:00 · 2 điểm · kết thúc tại cổng')
  })

  it('appends a warning count when any item has a warning', () => {
    const it: ItineraryItem[] = [
      mk({ type: 'entrance', startTime: '09:00', endTime: '09:10' }),
      mk({ type: 'ride', startTime: '09:20', endTime: '09:50', warning: 'Vượt quá giờ về dự kiến' }),
      mk({ type: 'return', startTime: '10:00', endTime: '10:00' }),
    ]
    expect(buildScheduleSummary(it)).toBe('🕘 09:00–10:00 · 1 điểm · kết thúc tại cổng · ⚠ 1 mục vượt/đụng giờ')
  })

  it('uses the last item end time when there is no return leg', () => {
    const it: ItineraryItem[] = [
      mk({ type: 'ride', startTime: '09:00', endTime: '09:30' }),
      mk({ type: 'show', startTime: '10:00', endTime: '10:30' }),
    ]
    expect(buildScheduleSummary(it)).toBe('🕘 09:00–10:30 · 2 điểm')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/scheduleSummary.test.ts`
Expected: FAIL — "Cannot find module './scheduleSummary'".

- [ ] **Step 3: Write the implementation**

```ts
// src/engine/scheduleSummary.ts
import type { ItineraryItem } from '../types'

// One-line Vietnamese summary of a computed itinerary. The itinerary is the single source
// of truth for time, so this string is always correct and updates whenever the schedule is
// recomputed (e.g. when the user changes arrival/departure). The LLM never produces times.
export function buildScheduleSummary(itinerary: ItineraryItem[]): string {
  if (itinerary.length === 0) return ''
  const start = itinerary[0].startTime
  const ret = itinerary.find((i) => i.type === 'return')
  const last = itinerary[itinerary.length - 1]
  const end = ret ? ret.startTime : last.endTime
  const count = itinerary.filter((i) => i.type === 'ride' || i.type === 'show' || i.type === 'meal').length
  const warns = itinerary.filter((i) => i.warning).length
  let s = `🕘 ${start}–${end} · ${count} điểm`
  if (ret) s += ' · kết thúc tại cổng'
  if (warns) s += ` · ⚠ ${warns} mục vượt/đụng giờ`
  return s
}
```

> Note: the dash in `${start}–${end}` is an EN DASH (`–`, U+2013), and `·` is a middot (U+00B7). Copy them exactly so the tests match.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/scheduleSummary.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/scheduleSummary.ts src/engine/scheduleSummary.test.ts
git commit -m "feat(engine): buildScheduleSummary one-line time summary"
```

---

## Task 2: Append the engine summary in `runPlan`

**Files:**
- Modify: `src/store/useStore.ts`
- Test: `src/store/runPlanSummary.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/store/runPlanSummary.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/aiClient', () => ({
  requestPlan: vi.fn(async () => ({
    action: 'plan', assistantText: 'Đã chọn vài trò cảm giác mạnh cho bạn!',
    chosenIds: ['zeus'], constraints: { arrivalTime: '09:00', departureTime: '19:00', meals: [] },
  })),
}))

import { useStore } from './useStore'

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ messages: [], entries: [], itinerary: [], busy: false, persona: '' })
})

describe('runPlan time summary', () => {
  it('appends the engine-built time summary to the assistant reply', async () => {
    await useStore.getState().runPlan('chơi cả ngày, thích cảm giác mạnh')
    const msgs = useStore.getState().messages
    const last = msgs[msgs.length - 1]
    expect(last.role).toBe('assistant')
    expect(last.text).toContain('Đã chọn vài trò cảm giác mạnh cho bạn!') // LLM qualitative text
    expect(last.text).toContain('🕘') // engine summary appended
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/store/runPlanSummary.test.ts`
Expected: FAIL — the assistant text has no `🕘` yet.

- [ ] **Step 3: Add the import (top of `src/store/useStore.ts`, with the other engine imports)**

```ts
import { buildScheduleSummary } from '../engine/scheduleSummary'
```

- [ ] **Step 4: Replace the assistant-message push inside `runPlan`**

Find this line in `runPlan`:
```ts
      get().pushMessage({ role: 'assistant', text: r.clarifyQuestion ? `${r.assistantText}\n${r.clarifyQuestion}` : r.assistantText })
```
Replace it with:
```ts
      const baseText = r.clarifyQuestion ? `${r.assistantText}\n${r.clarifyQuestion}` : r.assistantText
      const summary = (r.action === 'plan' || r.action === 'edit') ? buildScheduleSummary(get().itinerary) : ''
      get().pushMessage({ role: 'assistant', text: summary ? `${baseText}\n\n${summary}` : baseText })
```

(`get().itinerary` is already up to date here because `setEntries(...)` earlier in `runPlan` triggers `recompute()`.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/store/runPlanSummary.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, tsc clean.

- [ ] **Step 7: Commit**

```bash
git add src/store/useStore.ts src/store/runPlanSummary.test.ts
git commit -m "feat(store): append engine time-summary to AI replies"
```

---

## Task 3: Tighten the system prompt (no LLM time talk)

**Files:**
- Modify: `server/SYSTEM_PROMPT.md`

- [ ] **Step 1: Remove the broken bullet in section "Trích xuất thông tin ràng buộc"**

Delete this line (it is dangling/incomplete):
```
   - số điểm đến ()
```

- [ ] **Step 2: Replace the open/close-filter rule (in section "Lựa chọn trò chơi" → "Quy tắc nghiêm ngặt")**

Find:
```
     - TUYỆT ĐỐI KHÔNG đề xuất trò chơi hoặc show diễn đã đóng cửa hoặc không hoạt động trong khung giờ khách ở công viên. So sánh giờ mở/đóng cửa hoặc giờ diễn của trò chơi với giờ đến/giờ về của khách để lọc bỏ các trò chơi không khả dụng.
```
Replace with:
```
     - KHÔNG cần kiểm tra giờ mở/đóng cửa hay tự tính trò có kịp hay không — hệ thống sẽ tự xếp giờ và tự cảnh báo nếu một mục không kịp. Bạn chỉ chọn trò theo sở thích/đối tượng.
```

- [ ] **Step 3: Add a no-times rule to section "Lời nhắn thân thiện (assistantText)"**

After the existing bullets of that section, add:
```
   - TUYỆT ĐỐI KHÔNG nêu giờ cụ thể (định dạng HH:MM) của bất kỳ hoạt động nào trong assistantText, và không tự liệt kê lịch trình theo mốc giờ. Hệ thống sẽ tự tính và hiển thị giờ trên timeline. Bạn chỉ giải thích ĐỊNH TÍNH (vì sao chọn các trò, hợp đối tượng/sở thích nào).
```

- [ ] **Step 4: Sanity-check the file still ends with the menu header**

Run: `npx tsc --noEmit` (no code change, but confirms nothing else broke) and visually confirm the last non-empty line of `server/SYSTEM_PROMPT.md` is still:
```
DANH SÁCH TRÒ CHƠI (id — tên — khu — loại — phút — cường độ — hợp trẻ em):
```
(The server appends the live menu right after this line — it must remain the final line.)

- [ ] **Step 5: Commit**

```bash
git add server/SYSTEM_PROMPT.md
git commit -m "docs(prompt): forbid LLM time-narration; let engine own all time"
```

---

## Task 4: Final verification

**Files:** none (verification)

- [ ] **Step 1: Build + full test suite**

Run: `npm run build && npx vitest run`
Expected: build clean; all tests pass (previous suite + 5 new tests from Tasks 1–2).

- [ ] **Step 2: Manual smoke (optional but recommended)**

Run `npm run dev`, send a request, then change the time ("đổi giờ về thành 15h"). Confirm:
- The AI reply text contains NO `HH:MM` activity times, only a qualitative explanation.
- A `🕘 …` summary line appears at the end of the reply and matches the timeline.
- After the time change, the new reply's `🕘` line reflects the new window.

---

## Self-Review (done)

- **Spec coverage:** Prompt no-times + drop open/close filter + remove broken bullet → Task 3. `buildScheduleSummary` (start/end/count/gate/warns) → Task 1. Append in `runPlan` for plan/edit only → Task 2. Testing → Tasks 1, 2, 4. ✔
- **Type consistency:** `buildScheduleSummary(itinerary: ItineraryItem[]): string` defined in Task 1, imported/called identically in Task 2. `r.action`/`r.constraints`/`r.clarifyQuestion`/`get().itinerary` match existing `runPlan` usage. ✔
- **Placeholder scan:** none — every step has concrete code/commands. ✔
- **Note on unicode:** EN DASH `–` and middot `·` must be copied exactly (called out in Task 1).
