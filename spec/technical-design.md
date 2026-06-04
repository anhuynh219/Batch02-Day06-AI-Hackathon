# Thiết kế — Trợ lý AI lập lịch trình VinWonders Phú Quốc

> Ngày: 2026-06-03 · Trạng thái: Đã duyệt thiết kế, sẵn sàng lập kế hoạch implement
> Nguồn dữ liệu nội dung: [Vinwonder.md](../../../Vinwonder.md) · Thin SPEC: `Batch02-Day05-AI/02-group-spec/thin-spec-template.md`

## 1. Tổng quan

Một web app giúp khách du lịch (đoàn gia đình / nhóm bạn) **tự động lập lịch trình vui chơi trong ngày** tại VinWonders Phú Quốc. User nhập thời gian (giờ đến, giờ phải về), số người, sở thích, nhu cầu ăn uống bằng ngôn ngữ tự nhiên; AI trích yêu cầu, đề xuất trò chơi/show, và một **engine tính giờ** ráp thành lịch trình có buffer di chuyển + cảnh báo. User xem lịch trên **timeline** và **bản đồ thật (đường đi đánh số)**, rồi chỉnh sửa bằng **chat hoặc thao tác tay**.

**Triết lý AI:** Augmentation — AI gánh phần nặng (hiểu yêu cầu, lọc trò, tính giờ), **user là người quyết cuối** (chọn option, khoá/xoá mục).

## 2. User & Pain

- **User:** khách du lịch theo đoàn/gia đình, đang di chuyển, mệt, lười gõ dài, muốn nhanh & trực quan.
- **Pain:** phải tự đọc hàng tá mô tả + khung giờ rồi ghép thủ công với quỹ thời gian và sở thích → lãng phí thời gian, dễ lỡ show giờ cố định, dễ kiệt sức vì lịch không hợp lý.
- **Build slice:** nhận constraints (giờ bắt đầu, giờ về, thời gian trống, sở thích) → trả 1–3 option phù hợp kèm giờ dự kiến → xử lý ràng buộc hẹp/mâu thuẫn bằng giải thích + gợi ý thay thế.

## 3. Quyết định cốt lõi

| # | Quyết định | Chốt |
|---|---|---|
| Stack FE | React + Vite + TypeScript + Tailwind | ✅ |
| Bản đồ | **Leaflet + OpenStreetMap tiles** (không key) + **overlay GeoJSON thật** (đường đi nội khu, footprint tòa nhà), marker trò chơi, polyline đánh số theo lịch | ✅ |
| Tính đường đi | v1: **Haversine × hệ số đi bộ 1.3 ÷ ~4.5 km/h → phút** (không routing API). v2 tuỳ chọn: graph từ `footway` GeoJSON → Dijkstra | ✅ |
| AI | **Gemini API** (structured output / function calling), gọi qua **proxy backend** giấu key | ✅ |
| Kiến trúc lập lịch | **Hybrid** — Gemini hiểu ngôn ngữ & chọn trò; engine TS thuần tính giờ/buffer/validate | ✅ |
| Toạ độ khu/trò | Có sẵn `vinwonder.geojson` (317 feature: 161 đường, 73 tòa nhà). **Chỉ ~7 feature có tên** → GeoJSON dùng làm **nền bản đồ thật** + vài anchor (ranh giới park, Hải Vương). Vị trí trò chơi **gán tay 1 lần** qua màn calibration → lưu `feature-map.json` | ✅ |
| Layout | **B** — Chat (trái) · Bản đồ (phải-trên) · Timeline (phải-dưới) | ✅ |
| Cách sửa lịch | **Chat + thao tác tay** (kéo-thả, khoá, xoá); engine luôn tính lại buffer & cảnh báo | ✅ |

## 4. Mô hình dữ liệu

```ts
type Zone = {
  id: string; name: string; color: string;
  latLng: { lat: number; lng: number };   // toạ độ thật từ GeoJSON OSM (match name / centroid building)
  shortDesc: string;
};
// 6 khu: Đại lộ châu Âu, Thế giới lốc xoáy, Khu làng bí mật,
//        Cung điện Hải Vương, Thế giới phiêu lưu, Thế giới diệu kỳ

type Attraction = {
  id: string; name: string; zoneId: string;
  kind: "thrill" | "family" | "kids" | "water" | "indoor" | "show" | "aquarium";
  durationMin: number;
  intensity: 1 | 2 | 3 | 4 | 5;
  kidFriendly: boolean;
  tags: string[];                  // "cảm giác mạnh","trong nhà","check-in"...
  openTime: string; closeTime: string;   // mặc định "09:00"–"19:30"
  showTimes?: string[];            // chỉ show: ["19:00"]
};

type ItineraryItem = {
  id: string; refId: string | null;   // null nếu là meal/break
  type: "ride" | "show" | "meal" | "break";
  title: string;
  startTime: string; endTime: string;
  locked: boolean;
  warning?: string;                // "lịch khá sát","trò đóng cửa giờ này"...
};

type UserConstraints = {
  arrivalTime: string; departureTime: string;
  groupSize: number; hasKids: boolean;
  prefs: string[];                 // "thrill","water","show","relax"...
  meals: { type: "lunch" | "dinner" | "snack"; around: string }[];
  mustDo: string[]; avoid: string[];
};
```

`travelMatrix` / `travel.ts`: tính phút đi bộ giữa 2 toạ độ bằng haversine.

**Ranh giới quan trọng:** Gemini chỉ chọn `Attraction.id` từ dataset có sẵn và trả constraints — **không tự bịa trò hay tự tính giờ**. Engine ráp `startTime/endTime` + buffer + warning.

## 5. Kiến trúc & Components

### Frontend (React)
- `AppShell` — layout B.
- `ChatPanel` — message list + input; render text AI + `SuggestionCards` (1–3 option để user chọn → thêm vào lịch).
- `ParkMap` (Leaflet) — nền OSM tiles + **overlay GeoJSON thật** (đường đi nội khu, footprint tòa nhà); marker 6 khu/trò chơi (match `name` hoặc centroid building); **polyline đánh số 1→N** theo thứ tự lịch; click marker → popup; chọn mục timeline → bản đồ bay tới; **chế độ calibration** (gán feature/điểm cho từng trò, lưu vào localStorage/JSON).
- `Timeline` — thẻ `ItineraryItem` theo giờ; **kéo-thả** (dnd-kit) đổi thứ tự; nút **khoá/xoá**; badge **cảnh báo**.
- Store nhẹ (Zustand): `itinerary`, `constraints`, `messages`.

### Backend (proxy mỏng)
- `POST /api/plan` — nhận `{messages, constraints, itinerary, datasetTómTắt}` → gọi Gemini (structured output) → trả:
```ts
{ action: "plan" | "edit" | "clarify";
  constraints?: Partial<UserConstraints>;
  chosenIds?: string[];
  clarifyQuestion?: string;
  assistantText: string; }
```
- Giấu `GEMINI_API_KEY` (env), không lộ ra browser.

### Engine thuần TS (không LLM)
- `scheduleEngine.ts` — `chosenIds + constraints + travel` → `ItineraryItem[]` có giờ, buffer, warning; validate: giờ mở cửa/đóng cửa, giờ show cố định, lịch quá sát, trùng giờ, vượt quá `departureTime`.
- `travel.ts` — haversine → phút đi bộ.

## 6. Luồng dữ liệu (1 lượt lập lịch)

```text
User gõ prompt
  → POST /api/plan
  → Gemini trả {action, constraints, chosenIds | clarifyQuestion, assistantText}
      ├─ action="clarify" → ChatPanel hỏi lại 1–2 câu ngắn (Low-confidence) → loop
      └─ action="plan"|"edit"
            → scheduleEngine(chosenIds, constraints, travel) → ItineraryItem[]
            → Timeline cập nhật · Map vẽ route đánh số · Chat giải thích + cảnh báo
User sửa (chat: "bỏ tàu lượn"  |  tay: kéo-thả / khoá / xoá)
  → chạy lại engine (± Gemini nếu là yêu cầu ngôn ngữ) → render lại
```

## 7. Quy tắc của scheduleEngine

1. Bắt đầu từ `arrivalTime`, xếp tuần tự các trò đã chọn (ưu tiên mục `locked` giữ nguyên giờ).
2. Giữa 2 mục khác zone → chèn **buffer = travel(zoneA, zoneB)**.
3. Show có `showTimes` → **ghim vào khung giờ cố định**, các trò khác né quanh.
4. Cảnh báo nếu: thời gian trống < `durationMin` của trò; trò nằm ngoài `openTime–closeTime`; tổng lịch vượt `departureTime`; chuyển tiếp quá gấp (buffer ≤ thời gian thực tế).
5. Khi cảnh báo → gợi ý **trò gần nhất / ngắn hơn** thay thế (cùng `kind`/`tags`).

## 8. Bốn paths & xử lý lỗi

| Path | Hành vi |
|---|---|
| **Happy** | Đủ constraints → AI suggest 1–3 → user chọn → engine xếp lịch + hỏi tiếp khoảng trống kế. |
| **Low-confidence** | Prompt mơ hồ ("có trò nào vui không") → `action=clarify`, hỏi "đoàn có trẻ nhỏ? thích trong nhà hay ngoài trời?". |
| **Failure** | Lịch quá sát / trò đóng cửa → engine gắn warning + gợi ý thay thế. Gemini lỗi/JSON sai schema → validate + **retry 1 lần** → báo lỗi nhẹ nhàng. |
| **Correction** | User xoá/đổi trò → engine tính lại quỹ thời gian trống → gợi ý mới. |

**Failure mode nguy hiểm nhất:** bỏ qua thời gian di chuyển/xếp hàng → engine **luôn** chèn buffer + cảnh báo "Bạn mất ~X phút đi tới đó, lịch khá sát — đổi sang trò Y gần hơn không?".

## 9. Testing

- **Unit (`scheduleEngine`):** toán buffer; giờ mở/đóng cửa; ghim show giờ cố định; phát hiện lịch quá sát; trùng giờ; vượt `departureTime`.
- **Unit (`travel`):** haversine → phút đi bộ.
- **Integration:** mock Gemini `/api/plan` cho 4 paths.
- **Demo tay:** kịch bản screenshot/log cho Happy, Low-confidence, Failure, Correction.

## 10. Cấu trúc thư mục (dự kiến)

```text
vinwonders-scheduler/
├── server/            # proxy /api/plan, giấu Gemini key
│   └── plan.ts
├── src/
│   ├── data/          # zones.ts, attractions.ts (từ Vinwonder.md), park.geojson (từ OSM), feature-map.json (gán trò → feature)
│   ├── engine/        # scheduleEngine.ts, travel.ts (+ tests)
│   ├── ai/            # geminiClient, prompt, schema
│   ├── store/         # zustand store
│   ├── components/    # AppShell, ChatPanel, ParkMap, Timeline, SuggestionCards, Calibration
│   └── App.tsx
└── ...
```

## 11. Ngoài phạm vi (Out of scope — YAGNI)

- Đặt vé / thanh toán / tài khoản người dùng.
- Routing đi bộ thật trong công viên (chỉ ước lượng haversine).
- Đa ngày / nhiều công viên.
- Dữ liệu giờ chờ (queue time) thời gian thực.
- Mobile-native (chỉ web responsive).
