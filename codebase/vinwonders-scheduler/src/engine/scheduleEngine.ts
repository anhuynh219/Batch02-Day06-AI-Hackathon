import type { Attraction, ItineraryItem, PlanEntry, UserConstraints } from '../types'
import { toMinutes, toHHMM } from './time'

let _seq = 0
const nextId = () => `it-${++_seq}`

type Args = {
  entries: PlanEntry[]
  constraints: UserConstraints
  attractions: Record<string, Attraction>
  travel: (zoneA: string | null, zoneB: string | null) => number
  // Điểm bắt đầu cố định (quầy vé). Nếu có và có ít nhất 1 entry, lịch luôn mở đầu từ đây.
  entrance?: { name: string; zoneId: string; durationMin: number }
}

export function buildItinerary({ entries, constraints, attractions, travel, entrance }: Args): ItineraryItem[] {
  const items: ItineraryItem[] = []
  const departure = toMinutes(constraints.departureTime)
  let cursor = toMinutes(constraints.arrivalTime)
  let prevZone: string | null = null

  if (entrance && entries.length > 0) {
    const start = cursor
    const end = start + entrance.durationMin
    items.push({
      id: nextId(), refId: null, type: 'entrance',
      title: entrance.name, zoneId: entrance.zoneId,
      startTime: toHHMM(start), endTime: toHHMM(end), locked: true,
    })
    cursor = end
    prevZone = entrance.zoneId
  }

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
