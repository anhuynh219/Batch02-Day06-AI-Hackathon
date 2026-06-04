import { ChatPanel } from './ChatPanel'
import { ParkMap } from './ParkMap'
import { Timeline } from './Timeline'
import { SurveyModal } from './Survey/SurveyModal'
import { useStore } from '../store/useStore'

function Logo() {
  return (
    <svg viewBox="0 0 64 64" className="h-10 w-10 drop-shadow-sm" aria-hidden>
      <defs>
        <linearGradient id="hsun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD27A" />
          <stop offset="1" stopColor="#FF6B4A" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="30" r="14" fill="url(#hsun)" />
      <path d="M6 46c6 0 6 4 12 4s6-4 12-4 6 4 12 4 6-4 12-4 6 4 12 4" fill="none" stroke="#FFFDF8" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M6 54c6 0 6 4 12 4s6-4 12-4 6 4 12 4 6-4 12-4 6 4 12 4" fill="none" stroke="#9FE0DC" strokeWidth="3" strokeLinecap="round" opacity=".85" />
    </svg>
  )
}

export function AppShell() {
  const openSurvey = useStore((s) => s.openSurvey)
  const surveyOpen = useStore((s) => s.surveyOpen)
  // Chặn mở khảo sát khi AI đang xử lý: tránh việc hoàn tất survey lúc bận
  // khiến lịch nháp bị bỏ qua âm thầm (runPlan thoát sớm khi busy).
  const busy = useStore((s) => s.busy)
  return (
    <div className="tropic-bg grain relative h-full flex overflow-hidden">
      <aside className="relative z-10 w-[35%] min-w-[340px] flex flex-col bg-cream/95 backdrop-blur-sm border-r border-ink/10 shadow-[8px_0_30px_-20px_rgba(21,48,46,0.5)]">
        <header className="relative overflow-hidden px-5 py-4 bg-gradient-to-br from-ocean to-ocean-deep text-cream">
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-mango/25 blur-2xl" />
          <div className="pointer-events-none absolute right-10 bottom-2 h-16 w-16 rounded-full bg-coral/20 blur-xl" />
          <div className="relative flex items-center gap-3">
            <div className="animate-bob"><Logo /></div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ocean-light">VinWonders · Phú Quốc</div>
              <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight">Lịch Trình Vui Chơi</h1>
            </div>
            <button onClick={openSurvey} disabled={busy}
              title={busy ? 'AI đang xếp lịch — thử lại sau giây lát' : 'Cá nhân hoá lịch trình'}
              className="ml-auto self-start rounded-full bg-cream/15 px-3 py-1.5 text-[12px] font-semibold text-cream ring-1 ring-cream/30 backdrop-blur transition hover:bg-cream/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-cream/15">
              ✨ Cá nhân hoá
            </button>
          </div>
          <p className="relative mt-1.5 text-[12.5px] leading-snug text-cream/80">
            Trợ lý AI xếp lịch theo thời gian &amp; sở thích của đoàn bạn.
          </p>
        </header>
        <ChatPanel />
      </aside>

      <main className="relative z-10 flex-1 flex flex-col min-w-0 p-4 gap-4">
        <section className="reveal relative h-[56%] rounded-[20px] overflow-hidden ring-1 ring-ink/10 shadow-card" style={{ animationDelay: '60ms' }}>
          <div className="pointer-events-none absolute z-[500] left-3 top-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/90 px-3 py-1 text-[11px] font-semibold text-ocean-deep shadow ring-1 ring-ink/10 backdrop-blur">
              🗺️ Bản đồ công viên
            </span>
          </div>
          <ParkMap />
        </section>
        <section className="reveal flex-1 min-h-0 rounded-[20px] bg-cream/85 ring-1 ring-ink/10 shadow-card overflow-hidden" style={{ animationDelay: '140ms' }}>
          <Timeline />
        </section>
      </main>
      <SurveyModal key={surveyOpen ? 'open' : 'closed'} />
    </div>
  )
}
