import { useEffect, useState } from 'react'

// Animated "AI is thinking" bubble shown while a plan request is in flight. Cycles through
// pipeline-flavoured status lines (shimmering) above the bouncing typing dots so the wait
// feels alive and informative. Phases are illustrative, not tied to real backend events.
const PHASES = [
  'Đang đọc yêu cầu của bạn…',
  'Đang chọn trò chơi phù hợp…',
  'Đang sắp lộ trình gần nhất…',
  'Sắp xong rồi…',
]

export function GeneratingIndicator() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setI((x) => (x + 1) % PHASES.length), 1500)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="flex items-start animate-pop-in">
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-cream ring-1 ring-ink/10 px-3.5 py-2.5 shadow-sm">
        <span className="flex gap-1">
          <span className="typing-dot h-2 w-2 rounded-full bg-coral" />
          <span className="typing-dot h-2 w-2 rounded-full bg-mango" />
          <span className="typing-dot h-2 w-2 rounded-full bg-ocean" />
        </span>
        <span className="text-[13px] font-semibold shimmer-text">{PHASES[i]}</span>
      </div>
    </div>
  )
}
