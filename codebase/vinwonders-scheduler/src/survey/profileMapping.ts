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
