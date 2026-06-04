import { useEffect, useState } from 'react'

// Typewriter effect: reveals `text` progressively with a blinking caret. The backend
// returns the full assistantText in one structured-JSON response, so we simulate the
// "streaming" feel on the client. Duration is bounded (~steps capped) so long replies
// don't crawl. Respects prefers-reduced-motion by skipping straight to the full text.
export function StreamingText({ text, speedMs = 16, maxSteps = 140 }: {
  text: string
  speedMs?: number
  maxSteps?: number
}) {
  const reduce = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [n, setN] = useState(reduce ? text.length : 0)

  useEffect(() => {
    if (reduce || !text) { setN(text.length); return }
    setN(0)
    const total = text.length
    const step = Math.max(1, Math.ceil(total / maxSteps))
    let i = 0
    const id = window.setInterval(() => {
      i = Math.min(total, i + step)
      setN(i)
      if (i >= total) window.clearInterval(id)
    }, speedMs)
    return () => window.clearInterval(id)
  }, [text, speedMs, maxSteps, reduce])

  const done = n >= text.length
  return (
    <span>
      {text.slice(0, n)}
      {!done && <span className="stream-caret" aria-hidden />}
    </span>
  )
}
