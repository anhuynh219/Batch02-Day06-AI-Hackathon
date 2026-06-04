# Time Ownership — Thiết kế (sửa "LLM bối rối về giờ")

**Ngày:** 2026-06-04
**Trạng thái:** Đã duyệt (brainstorming) — chờ viết implementation plan

## 1. Vấn đề

LLM (Gemini) tự **nêu giờ giấc trong `assistantText`**, và giờ đó **lệch với lịch engine tính trên timeline**. Khi người dùng đổi giờ, phần LLM "kể" càng trôi khỏi thực tế. Gốc rễ: prompt vừa cấm tính giờ (dòng 23) vừa bắt so sánh giờ mở/đóng với giờ đến/về để lọc trò (dòng 24) — giao việc số học về thời gian cho LLM, vốn làm kém.

## 2. Nguyên tắc & quyết định

- **Một nguồn sự thật về giờ = engine xác định** (deterministic). Đã chính xác trên timeline.
- **KHÔNG thêm LLM-agent thời gian** (LLM dở số học + đẻ nguồn giờ thứ hai → vẫn lệch, lại chậm/tốn).
- LLM chỉ làm **NLU**: trích constraints + chọn trò theo sở thích. **Không đụng tới giờ.**
- Chat vẫn hiển thị giờ, nhưng **do engine sinh** (tự đúng, tự cập nhật khi đổi giờ).
- Dọn luôn mâu thuẫn lọc giờ mở/đóng trong prompt (đã duyệt).

## 3. Kiến trúc sau khi sửa

| Thành phần | Trách nhiệm |
|---|---|
| LLM (Gemini) | NLU: trích `constraints` + chọn `chosenIds` theo sở thích. **Không nêu giờ.** |
| Engine (xác định) | TẤT CẢ về giờ: xếp giờ, ghim show, cảnh báo đóng cửa/quá giờ, **và sinh dòng tóm tắt giờ**. |
| App (`runPlan`) | Ghép `assistantText` (định tính, từ LLM) + dòng tóm tắt giờ (từ engine). |

## 4. Phần 1 — Sửa `server/SYSTEM_PROMPT.md`

1. **Xoá** bullet hỏng `- số điểm đến ()` (mục 2).
2. **Xoá** dòng lọc giờ mở/đóng (mục 4, "TUYỆT ĐỐI KHÔNG đề xuất trò... đã đóng cửa... So sánh giờ mở/đóng..."). Thay bằng 1 câu: *"Không cần kiểm tra giờ mở/đóng hay tính trò có kịp không — hệ thống sẽ tự xếp giờ và cảnh báo nếu một mục không kịp."*
3. **Thêm** vào mục 5 (assistantText) luật:
   > *"TUYỆT ĐỐI KHÔNG nêu giờ cụ thể (định dạng HH:MM) của bất kỳ hoạt động nào trong `assistantText`, và không tự liệt kê lịch trình theo mốc giờ. Hệ thống sẽ tự tính và hiển thị giờ. Bạn chỉ giải thích ĐỊNH TÍNH (vì sao chọn các trò, hợp đối tượng/sở thích nào)."*

Giữ nguyên: việc LLM trích `arrival_time`/`departure_time` vào `constraints` (đó là đọc input của khách — NLU, không phải tự tính).

## 5. Phần 2 — Engine sinh tóm tắt giờ

File mới `src/engine/scheduleSummary.ts`:

```ts
import type { ItineraryItem } from '../types'

// Tóm tắt 1 dòng về lịch, sinh từ itinerary đã tính (nguồn sự thật về giờ).
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

Quy ước:
- `start` = giờ bắt đầu mục đầu (quầy vé / giờ đến).
- `end` = giờ chặng "về cổng" nếu có, nếu không thì giờ kết thúc mục cuối.
- `count` = số trò chơi + show + bữa ăn (không tính quầy vé/điểm về/nghỉ).
- `warns` = số mục có cảnh báo (đóng cửa / quá giờ / không kịp show).

## 6. Phần 3 — Ghép trong `src/store/useStore.ts` (`runPlan`)

Sau khi `setEntries(ordered)` (đã recompute itinerary), ghép tóm tắt vào lời nhắn:

```ts
const baseText = r.clarifyQuestion ? `${r.assistantText}\n${r.clarifyQuestion}` : r.assistantText
const summary = (r.action === 'plan' || r.action === 'edit') ? buildScheduleSummary(get().itinerary) : ''
const text = summary ? `${baseText}\n\n${summary}` : baseText
get().pushMessage({ role: 'assistant', text })
```

`clarify` không có lịch → không có tóm tắt. `plan`/`edit` luôn kèm tóm tắt giờ chính xác từ engine.

## 7. Files đụng tới

| File | Việc |
|---|---|
| `server/SYSTEM_PROMPT.md` | sửa prompt (mục 4 trên) |
| `src/engine/scheduleSummary.ts` | **mới** — `buildScheduleSummary` |
| `src/engine/scheduleSummary.test.ts` | **mới** — unit test |
| `src/store/useStore.ts` | ghép tóm tắt vào assistantText trong `runPlan` |

## 8. Testing

- Unit test `buildScheduleSummary`:
  - itinerary rỗng → `''`.
  - có entrance + vài trò + return → `🕘 09:00–17:00 · N điểm · kết thúc tại cổng`.
  - có mục `warning` → kèm `⚠ k mục vượt/đụng giờ`.
  - không có return (trường hợp biên) → dùng endTime mục cuối, không có "kết thúc tại cổng".
- Giữ build sạch + toàn bộ test cũ xanh.

## 9. Ngoài phạm vi (YAGNI)

- Không thêm tổng quãng đi bộ (km) vào tóm tắt (có thể thêm sau).
- Không tự cắt bớt trò khi quá giờ (engine vẫn chỉ cảnh báo; "auto-trim cho vừa giờ" là việc riêng, để sau nếu cần).
- Không cập nhật lại tóm tắt cũ trong chat khi người dùng kéo-thả timeline sau đó (tóm tắt là ảnh chụp tại thời điểm trả lời; timeline luôn là bản sống).
