import type { Zone } from '../types'

export const ZONES: Zone[] = [
  { id: 'european', name: 'Đại lộ châu Âu', color: '#e0533d', latLng: { lat: 10.33760, lng: 103.85470 }, shortDesc: 'Phố châu Âu trung cổ, show Once, lâu đài' },
  { id: 'tornado',  name: 'Thế giới lốc xoáy', color: '#2f9fd0', latLng: { lat: 10.338460, lng: 103.853269 }, shortDesc: 'Công viên nước lớn nhất ĐNA' },
  { id: 'viking',   name: 'Khu làng bí mật', color: '#d0a02f', latLng: { lat: 10.33820, lng: 103.85360 }, shortDesc: 'Làng Viking, zipline, thử thách vận động' },
  { id: 'neptune',  name: 'Cung điện Hải Vương', color: '#46b37a', latLng: { lat: 10.33605, lng: 103.85306 }, shortDesc: 'Thuỷ cung top 5 thế giới (kiến trúc rùa)' },
  { id: 'adventure',name: 'Thế giới phiêu lưu', color: '#7a5cd0', latLng: { lat: 10.33650, lng: 103.85550 }, shortDesc: 'Maya, Hy Lạp, rừng Amazon, tàu lượn Zeus' },
  { id: 'wonder',   name: 'Thế giới diệu kỳ', color: '#d04f9f', latLng: { lat: 10.33560, lng: 103.85440 }, shortDesc: 'Cổ tích, Ba Tư, Ai Cập, miền Tây' },
]

// Điểm bắt đầu cố định của mọi lịch trình: quầy vé / cổng vào.
// Đặt tại cổng phía BẮC sát bãi đỗ xe: nút đường đi bộ gần bãi xe nhất trong geojson
// (10.341548/103.854801, cách bãi xe ~10m) — vừa đúng vị trí cổng vừa nằm trên mạng
// đường nên định tuyến nối thẳng. Chỉnh tinh qua Calibration.
export const ENTRANCE: Zone = {
  id: 'entrance',
  name: 'Quầy vé / Cổng vào',
  color: '#334155',
  latLng: { lat: 10.341548, lng: 103.854801 },
  shortDesc: 'Điểm bắt đầu — mua vé và vào cổng',
}

export const ZONES_BY_ID: Record<string, Zone> =
  Object.fromEntries([ENTRANCE, ...ZONES].map((z) => [z.id, z]))

// Danh sách điểm có thể chỉnh toạ độ (gồm cả quầy vé).
export const CALIBRATABLE_ZONES: Zone[] = [ENTRANCE, ...ZONES]
