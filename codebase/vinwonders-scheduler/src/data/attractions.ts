import type { Attraction } from '../types'

const H = { open: '09:00', close: '19:30' }
const A = (
  id: string, name: string, zoneId: string,
  kind: Attraction['kind'], durationMin: number, intensity: Attraction['intensity'],
  kidFriendly: boolean, tags: string[], showTimes?: string[],
  // Toạ độ riêng của điểm (tuỳ chọn). Bỏ trống -> dùng toạ độ khu. Cách dễ nhất để
  // đặt: bật "📍 Chỉnh toạ độ điểm" trên bản đồ, chọn điểm rồi click (lưu localStorage).
  latLng?: { lat: number; lng: number },
): Attraction => ({
  id, name, zoneId, kind, durationMin, intensity, kidFriendly, tags,
  openTime: H.open, closeTime: kind === 'show' ? '19:30' : H.close, showTimes, latLng,
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
