import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '../store/useStore'
import { ZONES_BY_ID } from '../data/zones'
import type { ItineraryItem } from '../types'

const KIND_ICON: Record<string, string> = {
  entrance: '🎟️', return: '🏁', show: '🎆', meal: '🍜', break: '🌴', ride: '🎠',
}

function Card({ item, idx }: { item: ItineraryItem; idx: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const removeItem = useStore((s) => s.removeItem)
  const toggleLock = useStore((s) => s.toggleLock)
  const setSelected = useStore((s) => s.setSelected)
  const selectedId = useStore((s) => s.selectedItemId)

  const isEntrance = item.type === 'entrance'
  const isFixed = isEntrance || item.type === 'return'
  const zone = item.zoneId ? ZONES_BY_ID[item.zoneId] : null
  const color = zone?.color ?? '#5B7370'
  const selected = selectedId === item.id

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}
      onClick={() => setSelected(item.id)}
      className={`group relative shrink-0 w-[180px] rounded-2xl bg-white pl-4 pr-3 py-2.5 text-sm cursor-pointer select-none transition
        ring-1 ${selected ? 'ring-2 ring-coral shadow-lift' : 'ring-ink/10 shadow-card hover:shadow-lift hover:-translate-y-0.5'}`}>
      {/* colored ticket spine + perforation notches */}
      <span className="absolute left-0 top-2 bottom-2 w-1.5 rounded-full" style={{ background: color }} />
      <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-cream ring-1 ring-ink/10" />

      <div className="flex items-center justify-between gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white shadow-sm" style={{ background: color }}>{idx}</span>
        <span className="font-mono text-[11px] tracking-tight text-muted">{item.startTime}<span className="text-ink/30">–</span>{item.endTime}</span>
        {!isFixed && (
          <span {...attributes} {...listeners} className="ml-auto cursor-grab text-ink/25 hover:text-ink/50 transition" title="Kéo để sắp lại">⠿</span>
        )}
      </div>

      <div className="mt-1.5 font-semibold leading-snug text-ink">
        <span className="mr-1">{KIND_ICON[item.type] ?? '📍'}</span>{item.title}
      </div>
      {zone && !isFixed && <div className="text-[11px] text-muted mt-0.5">{zone.name}</div>}

      {item.warning && (
        <div className="mt-1.5 flex items-start gap-1 rounded-lg bg-coral/10 px-2 py-1 text-[11px] leading-tight text-coral-deep ring-1 ring-coral/20">
          <span>⚠</span><span>{item.warning}</span>
        </div>
      )}

      {isFixed ? (
        <div className="mt-1.5 text-[11px] font-medium text-ocean-deep">{isEntrance ? 'Điểm bắt đầu' : 'Điểm kết thúc'}</div>
      ) : (
        <div className="mt-2 flex gap-1.5 opacity-70 group-hover:opacity-100 transition">
          <button onClick={(e) => { e.stopPropagation(); toggleLock(item.id) }}
            title={item.locked ? 'Đang khoá giờ' : 'Khoá giờ'}
            className={`text-xs px-2 py-1 rounded-lg ring-1 transition ${item.locked ? 'bg-ocean/10 ring-ocean/30 text-ocean-deep' : 'bg-cream ring-ink/10 text-muted hover:ring-ocean/30'}`}>
            {item.locked ? '🔒' : '🔓'}
          </button>
          <button onClick={(e) => { e.stopPropagation(); removeItem(item.id) }}
            className="text-xs px-2 py-1 rounded-lg bg-cream ring-1 ring-ink/10 text-coral-deep hover:bg-coral/10 hover:ring-coral/30 transition">
            Xoá
          </button>
        </div>
      )}
    </div>
  )
}

export function Timeline() {
  const itinerary = useStore((s) => s.itinerary)
  const reorder = useStore((s) => s.reorder)
  const optimize = useStore((s) => s.optimize)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const optimizable = itinerary.filter((i) => i.type === 'ride').length >= 2

  if (itinerary.length === 0)
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        <div className="text-3xl animate-bob">🧭</div>
        <p className="mt-2 font-display text-lg text-ink/70">Lịch trình của bạn sẽ xuất hiện ở đây</p>
        <p className="text-[12.5px] text-muted">Nhắn cho trợ lý bên trái để bắt đầu xếp lịch.</p>
      </div>
    )

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-display text-lg font-semibold text-ink">Lịch trình trong ngày</h2>
        <span className="rounded-full bg-ocean/10 px-2 py-0.5 text-[11px] font-semibold text-ocean-deep">{itinerary.length} điểm</span>
        <span className="hidden md:inline text-[11px] text-muted">Kéo thẻ để sắp lại · 🔒 khoá giờ</span>
        <button onClick={optimize} disabled={!optimizable}
          title="Sắp lại thứ tự để đi bộ ít nhất, giữ giờ show, kết thúc ở quầy vé"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-ocean to-ocean-deep text-cream px-3 py-1.5 text-[12px] font-semibold shadow transition hover:shadow-lift hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0">
          🧭 Tối ưu lộ trình
        </button>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => { if (over && active.id !== over.id) reorder(String(active.id), String(over.id)) }}>
          <SortableContext items={itinerary.map((i) => i.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-3 items-start pb-2 h-full">
              {itinerary.map((it, i) => (
                <div key={it.id} className="flex items-center gap-3">
                  <Card item={it} idx={i + 1} />
                  {i < itinerary.length - 1 && <span className="text-ink/25 text-lg">→</span>}
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}
