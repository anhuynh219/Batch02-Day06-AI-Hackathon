# VinWonders AI Scheduler

Trợ lý AI lập lịch vui chơi VinWonders Phú Quốc (React + Gemini + Leaflet).

## Setup

1. `npm install`
2. Tạo môi trường Python và cài FastAPI backend:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   ```
3. Copy `.env.example` → `.env`, điền `GEMINI_API_KEY` (lấy tại [aistudio.google.com](https://aistudio.google.com/app/apikey) — key bắt đầu bằng `AIza`).
4. `npm run dev` (chạy đồng thời web + FastAPI api).
5. Mở URL Vite in ra (mặc định [http://localhost:5173](http://localhost:5173)).

## Test

`npm run test`

## Kiến trúc (Hybrid)

- Gemini (qua FastAPI `backend/`) hiểu ngôn ngữ tự nhiên + CHỌN trò chơi bằng id từ shared catalog; không tự tính giờ.
- `src/engine/scheduleEngine.ts` tính giờ + buffer di chuyển + cảnh báo (đóng cửa / quá giờ về / không kịp show). Lịch luôn bắt đầu từ **quầy vé / cổng vào**.
- `src/lib/router.ts` dựng đồ thị từ các đường `highway` trong geojson (footway/service) và chạy **Dijkstra** để: (a) tính thời gian đi bộ theo **lối đi thật** (không phải đường chim bay), (b) vẽ route bám theo đường như Google Maps. Tự fallback về haversine nếu graph chưa nạp hoặc 2 điểm thuộc thành phần rời nhau.
- Bản đồ Leaflet nạp `public/vinwonder.geojson` (đường đi + tòa nhà thật), vẽ route đánh số theo lối đi; chế độ "chỉnh toạ độ" để chấm vị trí điểm (gồm cả quầy vé) cho khớp thực tế.

## Demo 4 paths (cần GEMINI_API_KEY thật)

- **Happy:** "Đoàn 4 người có bé 6 tuổi, đến 9h về 15h, thích nhẹ nhàng và muốn xem show, ăn trưa ~12h." → AI lập lịch, timeline + route hiện ra.
- **Low-confidence:** "Có trò nào vui không?" → AI hỏi lại (trẻ nhỏ? trong nhà/ngoài trời?).
- **Failure:** "Mình chỉ rảnh 19:00–19:30, chơi tàu lượn Zeus và xem show Once." → các mục có cảnh báo ⚠ (đóng cửa / không kịp / quá giờ về).
- **Correction:** sau khi có lịch, bấm 🔒 khoá 1 mục rồi "Xoá" mục khác (hoặc gõ "bỏ tàu lượn Zeus") → lịch + route tính lại.
