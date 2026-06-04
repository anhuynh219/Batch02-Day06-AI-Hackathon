import { ATTRACTIONS_BY_ID } from '../data/attractions'
import { ZONES_BY_ID } from '../data/zones'

export function SuggestionCards({ ids }: { ids: string[] }) {
  const items = ids.map((id) => ATTRACTIONS_BY_ID[id]).filter(Boolean)
  if (items.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((a) => {
        const color = ZONES_BY_ID[a.zoneId]?.color ?? '#5B7370'
        return (
          <span key={a.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-white ring-1 ring-ink/10 pl-1.5 pr-2.5 py-1 text-[11.5px] shadow-sm animate-pop-in">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            <span className="font-medium text-ink">{a.name}</span>
            <span className="text-muted/80">· {a.durationMin}p</span>
          </span>
        )
      })}
    </div>
  )
}
