import type { Question } from '../../survey/questions'

export function QuestionStep({ question, value, onChange }: {
  question: Question
  value: string[]
  onChange: (next: string[]) => void
}) {
  function pick(v: string) {
    if (question.multi) {
      onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
    } else {
      onChange([v])
    }
  }
  return (
    <div>
      <h3 className="font-display text-xl font-semibold text-ink">{question.title}</h3>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {question.options.map((o) => {
          const active = value.includes(o.value)
          return (
            <button key={o.value} type="button" onClick={() => pick(o.value)}
              aria-pressed={active}
              className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left text-[13.5px] font-medium ring-1 transition ${
                active ? 'bg-coral/10 ring-coral text-ink shadow-card' : 'bg-white ring-ink/10 text-ink/80 hover:ring-coral/40 hover:-translate-y-0.5'}`}>
              <span className="text-xl">{o.icon}</span>
              <span className="flex-1">{o.label}</span>
              {active && <span className="text-coral">✓</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
