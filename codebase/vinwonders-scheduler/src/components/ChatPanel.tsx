import { useState } from 'react'
import { useStore } from '../store/useStore'
import { SuggestionCards } from './SuggestionCards'
import { StreamingText } from './StreamingText'
import { GeneratingIndicator } from './GeneratingIndicator'

const EXAMPLES = [
  'Đoàn 4 người có bé 6 tuổi, đến 9h về 15h, thích nhẹ nhàng và muốn xem show, ăn trưa ~12h.',
  'Nhóm 2 bạn trẻ mê cảm giác mạnh, chơi cả ngày, ưu tiên tàu lượn.',
  'Có trò nào vui không?',
]

export function ChatPanel() {
  const [input, setInput] = useState('')
  const { messages, busy, lastSuggestedIds, runPlan } = useStore()

  async function send(text?: string) {
    const value = (text ?? input).trim()
    if (!value || busy) return
    setInput('')
    await runPlan(value)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="reveal space-y-3">
            <div className="rounded-2xl bg-gradient-to-br from-mango/15 to-coral/10 ring-1 ring-coral/20 p-4">
              <div className="font-display text-lg font-semibold text-ink">Bắt đầu thế nào? 🌴</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Hãy tả đoàn của bạn: <span className="text-ink/80 font-medium">mấy người, đến/về lúc mấy giờ, thích trò gì, ăn uống ra sao</span> — mình sẽ xếp lịch &amp; vẽ đường đi.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted/80">Gợi ý nhanh</div>
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => send(ex)}
                  className="group block w-full text-left rounded-xl bg-cream ring-1 ring-ink/10 px-3 py-2 text-[12.5px] text-ink/85 transition hover:ring-coral/40 hover:bg-coral/5 hover:shadow-card">
                  <span className="mr-1 text-coral group-hover:translate-x-0.5 inline-block transition-transform">↳</span>{ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[88%] px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap shadow-sm animate-pop-in ${
              m.role === 'user'
                ? 'bg-gradient-to-br from-ocean to-ocean-deep text-cream rounded-2xl rounded-br-md'
                : 'bg-cream ring-1 ring-ink/10 text-ink rounded-2xl rounded-bl-md'}`}>
              {m.role === 'assistant' && i === messages.length - 1
                ? <StreamingText text={m.text} />
                : m.text}
            </div>
            {m.role === 'assistant' && i === messages.length - 1 && <SuggestionCards ids={lastSuggestedIds} />}
          </div>
        ))}

        {busy && <GeneratingIndicator />}
      </div>

      <div className="p-3 border-t border-ink/10 bg-cream/70">
        <div className="flex items-center gap-2 rounded-full bg-white ring-1 ring-ink/10 focus-within:ring-2 focus-within:ring-coral/50 pl-4 pr-1.5 py-1 shadow-inset transition">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Tả đoàn của bạn…"
            className="flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-muted/60 outline-none" />
          <button onClick={() => send()} disabled={busy}
            aria-label="Gửi"
            className="grid place-items-center h-9 w-9 rounded-full bg-gradient-to-br from-coral to-coral-deep text-white shadow transition hover:shadow-lift hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
