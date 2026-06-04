import { useMapEvents } from 'react-leaflet'
import { useStore } from '../store/useStore'
import { CALIBRATABLE_ZONES } from '../data/zones'

export function CalibrationClickLayer() {
  const calibrating = useStore((s) => s.calibrating)
  const zoneId = useStore((s) => s.calibratingZoneId)
  const setCoord = useStore((s) => s.setCoord)
  useMapEvents({
    click(e) {
      if (calibrating && zoneId) setCoord(zoneId, e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export function CalibrationPanel() {
  const { calibrating, setCalibrating, calibratingZoneId, setCalibratingZone, coordOverrides } = useStore()
  return (
    <div className="absolute z-[1000] top-3 right-3 w-60 rounded-2xl bg-cream/95 backdrop-blur shadow-lift ring-1 ring-ink/10 p-2.5 text-xs">
      <label className="flex items-center gap-2 font-semibold text-ink cursor-pointer">
        <input type="checkbox" checked={calibrating} onChange={(e) => setCalibrating(e.target.checked)}
          className="accent-coral h-3.5 w-3.5" />
        <span>📍 Chỉnh toạ độ điểm</span>
      </label>
      {calibrating && (
        <div className="mt-2 space-y-1">
          <div className="text-muted">Chọn điểm rồi click lên bản đồ:</div>
          {CALIBRATABLE_ZONES.map((z) => (
            <button key={z.id} onClick={() => setCalibratingZone(z.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ring-1 ${
                calibratingZoneId === z.id ? 'bg-coral/10 ring-coral/40 text-ink' : 'bg-white/70 ring-transparent hover:ring-ink/10 text-ink/80'}`}>
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: z.color }} />
              <span className="flex-1 truncate">{z.name}</span>
              {coordOverrides[z.id] && <span className="text-ocean">✓</span>}
            </button>
          ))}
          <div className="text-muted/80 pt-0.5">Toạ độ lưu tự động (localStorage).</div>
        </div>
      )}
    </div>
  )
}
