# Cold-start Survey — Thiết kế

**Ngày:** 2026-06-04
**Trạng thái:** Đã duyệt (brainstorming) — chờ viết implementation plan

## 1. Mục tiêu

Giảm ma sát "màn hình trắng" (cold start): trước khi người dùng phải tự nghĩ ra prompt cho AI,
hỏi một bộ khảo sát ngắn để học **hành vi + tính cách** người dùng, rồi:

1. **Pre-fill** `UserConstraints` (giờ, số người, trẻ nhỏ, sở thích, né tránh, bữa ăn).
2. **Sinh lịch nháp** ngay bằng cách tái dùng luồng AI hiện có.
3. **Lưu một persona** (1 câu mô tả) và bơm vào `systemInstruction` cho mọi lần chat sau.

Không cần đăng nhập. Hồ sơ lưu `localStorage`.

## 2. Quyết định đã chốt

| Hạng mục | Quyết định |
|---|---|
| Đầu ra khảo sát | Cả ba: pre-fill constraints + sinh lịch nháp + lưu persona |
| Nội dung | 4 nhóm: thực tế cơ bản, gu trải nghiệm, tính cách & nhịp độ, hạn chế & né tránh |
| Độ dài | ~6 câu tap nhanh (chips/cards), có nút **Bỏ qua** |
| Thời điểm | Hiện lần đầu mở app (cờ localStorage); nút "✨ Cá nhân hoá" để mở lại |
| Kiến trúc | **Hướng A — Lai**: survey → constraints + seed prompt → `requestPlan` (Gemini chọn ID, engine tính giờ); persona tách riêng |

**Nguyên tắc giữ nguyên:** AI chỉ làm NLU + chọn `id` trò chơi; engine xác định lo toàn bộ tính giờ.

## 3. Bộ câu hỏi (6 câu)

| # | Câu hỏi | Kiểu | Lựa chọn | Map vào |
|---|---|---|---|---|
| Q1 | Khung giờ chơi | đơn | Cả ngày 9:00–19:00 / Sáng 9:00–13:00 / Chiều–tối 13:00–19:30 / Tự chọn | `arrivalTime`, `departureTime`, suy ra `meals` |
| Q2 | Đi cùng ai | đơn | Một mình / Cặp đôi / Nhóm bạn / Gia đình có trẻ nhỏ | `groupSize` (1/2/4/4), `hasKids` |
| Q3 | Khẩu vị cảm giác | đơn | Mạo hiểm tối đa / Cân bằng / Nhẹ nhàng / Hợp trẻ nhỏ | `intensity` mong muốn → `prefs` |
| Q4 | Mê kiểu trải nghiệm | nhiều | Tàu lượn mạnh / Công viên nước / Thuỷ cung / Show & sống ảo / Cổ tích–trong nhà / Khám phá phiêu lưu | `prefs` (theo `kind`/`tags`) |
| Q5 | Nhịp độ | đơn | Thong thả (ít điểm) / Cân bằng / Chơi hết mình (nhiều điểm) | `persona.pace` + số điểm mục tiêu |
| Q6 | Điều cần tránh | nhiều (có thể trống) | Sợ độ cao / Không thích ướt / Ngại xếp hàng / Ăn chay / Dị ứng / Không có | `avoid` |

Bữa ăn suy ra từ Q1 (cả ngày → thêm trưa; có buổi tối → thêm tối) — không hỏi riêng.

## 4. Data model

`src/survey/types.ts`:
```ts
export type SurveyProfile = {
  timeRange: 'full' | 'morning' | 'afternoon' | 'custom'
  arrivalTime: string
  departureTime: string
  groupType: 'solo' | 'couple' | 'friends' | 'family'
  intensity: 'high' | 'balanced' | 'gentle' | 'kids'
  interests: string[]   // 'thrill' | 'water' | 'aquarium' | 'show' | 'indoor' | 'adventure'
  pace: 'relaxed' | 'balanced' | 'packed'
  avoid: string[]       // 'heights' | 'wet' | 'queue' | 'vegetarian' | 'allergy'
  completedAt: string
}
```

## 5. Lớp logic thuần — `src/survey/profileMapping.ts`

Không phụ thuộc React/AI; là nơi tập trung mọi suy diễn, dễ unit-test.

- `toConstraints(profile): Partial<UserConstraints>`
  - giờ: từ `timeRange` (hoặc `arrival/departureTime` khi `custom`).
  - `groupSize`, `hasKids`: từ `groupType`.
  - `prefs`: gộp từ `intensity` + `interests` (chuỗi tiếng Việt khớp gu).
  - `avoid`: từ `avoid` (vd `heights` → "trò trên cao/độ cao"; `wet` → "trò nước").
  - `meals`: suy ra từ khung giờ.
- `toPersona(profile): string` — 1 câu tiếng Việt tóm tắt.
- `toSeedPrompt(profile): string` — câu yêu cầu tự nhiên làm tin nhắn đầu cho `requestPlan`.

## 6. Luồng

```
Lần đầu mở app (chưa có profile) → SurveyModal (6 câu)
   ├─ Bỏ qua  → đóng, vào chat trống (hành vi như hiện tại)
   └─ Hoàn tất → completeSurvey(profile):
        - lưu profile + persona vào store + localStorage, surveyDone = true
        - setConstraints(toConstraints(profile))
        - requestPlan([{role:'user', text: toSeedPrompt(profile)}], '')  ← tái dùng nguyên si
        - đẩy assistantText + lịch nháp vào khung chat/timeline
```

Nút "✨ Cá nhân hoá" ở header → `resetSurvey()` mở lại modal **điền sẵn câu trả lời cũ** (chế độ chỉnh sửa); profile chỉ bị ghi đè khi người dùng bấm Hoàn tất, bấm Bỏ qua giữ nguyên hồ sơ cũ.

## 7. Persona bền vững vào system prompt

- Store giữ `persona: string`.
- `src/lib/aiClient.ts` gửi kèm `persona` trong body `POST /api/plan`.
- `server/index.ts` đọc `persona`, truyền xuống `askGemini`.
- `server/gemini.ts`: nối persona vào `systemInstruction` — **sau** template `SYSTEM_PROMPT.md`, **trước** menu, dạng:
  ```
  # Hồ sơ khách
  {persona}
  ```
- Khi không có persona (bỏ qua khảo sát) → không nối gì, hành vi như cũ.

## 8. State (`useStore`)

Thêm:
- `profile: SurveyProfile | null`, `persona: string`, `surveyDone: boolean` (mirror localStorage).
- `completeSurvey(profile)`: như mục 6.
- `resetSurvey()`: mở lại khảo sát (cho nút Cá nhân hoá).

## 9. Component

- `src/components/Survey/SurveyModal.tsx` — khung modal, điều hướng bước, nút Bỏ qua/Quay lại/Hoàn tất, thanh tiến độ.
- `src/components/Survey/QuestionStep.tsx` — render 1 câu (chips đơn/nhiều) data-driven từ `src/survey/questions.ts`.
- `src/survey/questions.ts` — định nghĩa 6 câu (id, tiêu đề, kiểu chọn, danh sách lựa chọn + icon).
- `src/components/AppShell.tsx` — gắn `SurveyModal`; thêm nút "✨ Cá nhân hoá".

## 10. Files đụng tới

| File | Việc |
|---|---|
| `src/survey/types.ts` | **mới** — `SurveyProfile` |
| `src/survey/profileMapping.ts` | **mới** — mapping thuần |
| `src/survey/questions.ts` | **mới** — 6 câu data-driven |
| `src/components/Survey/SurveyModal.tsx`, `QuestionStep.tsx` | **mới** — UI |
| `src/store/useStore.ts` | profile/persona/surveyDone + actions |
| `src/lib/aiClient.ts` | gửi kèm `persona` |
| `server/index.ts`, `server/gemini.ts` | nhận & nối persona vào systemInstruction |
| `src/components/AppShell.tsx` | gắn modal + nút Cá nhân hoá |

## 11. Testing

- Unit test `profileMapping`: mỗi nhánh profile → constraints/avoid/meals/persona/seed đúng.
- Test store: `completeSurvey` set đúng state + gọi mapping; `resetSurvey`.
- Giữ build sạch + 29 test cũ xanh.

## 12. Ngoài phạm vi (YAGNI)

- Không đăng nhập / đồng bộ server hồ sơ.
- Không hỏi ngân sách, không A/B testing câu hỏi.
- Không sinh logic chọn trò local song song (đã chọn Hướng A dùng AI).
